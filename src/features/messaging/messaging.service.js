// src/features/messaging/messaging.service.js — chat 1:1 nutri <-> paciente.
// Persiste conversas/mensagens, mantém contadores de não-lidas, emite evento
// em tempo real (Socket.io) e dispara notificação ao destinatário.
const { Op } = require('sequelize');
const { Conversation, Message, PatientProfile, User } = require('../../models');
const AppError = require('../../utils/app-error');
const { ROLES, MESSAGE_TYPES, NOTIFICATION_TYPES } = require('../../config/constants');
const { emitToUser } = require('../../providers/websocket/socket-server');
const notificationService = require('../notification/notification.service');
const storage = require('../../providers/storage/r2');

async function loadConversation(id) {
  const conv = await Conversation.findByPk(id, {
    include: [{ model: PatientProfile, as: 'patientProfile', attributes: ['id', 'userId', 'nutritionistId'] }],
  });
  if (!conv) throw AppError.notFound('Conversa não encontrada.', 'CONVERSATION_NOT_FOUND');
  return conv;
}

// 'nutri' | 'patient' | 'admin' — lança se não participa.
function assertParticipant(actor, conv) {
  if (actor.role === ROLES.ADMIN) return 'admin';
  if (actor.id === conv.nutritionistId) return 'nutri';
  if (conv.patientProfile && actor.id === conv.patientProfile.userId) return 'patient';
  throw AppError.forbidden('Você não participa desta conversa.', 'NOT_PARTICIPANT');
}

function previewFor(type, body) {
  if (type === MESSAGE_TYPES.IMAGE) return '📷 Imagem';
  if (type === MESSAGE_TYPES.DOC) return '📄 Documento';
  if (type === MESSAGE_TYPES.AUDIO) return '🎤 Áudio';
  return (body || '').slice(0, 160);
}

// Cria (ou recupera) a conversa entre a nutri do paciente e o paciente.
async function getOrCreate(actor, patientProfileId) {
  if (!patientProfileId) throw AppError.badRequest('patientProfileId é obrigatório.', 'MISSING_PROFILE');
  const profile = await PatientProfile.findByPk(patientProfileId);
  if (!profile) throw AppError.notFound('Perfil de paciente não encontrado.', 'PROFILE_NOT_FOUND');

  const isNutri = actor.role === ROLES.NUTRITIONIST && profile.nutritionistId === actor.id;
  const isPatient = actor.role === ROLES.PATIENT && profile.userId === actor.id;
  if (!(isNutri || isPatient || actor.role === ROLES.ADMIN)) {
    throw AppError.forbidden('Sem permissão sobre esta conversa.', 'FORBIDDEN');
  }
  if (!profile.nutritionistId) throw AppError.badRequest('Paciente sem nutricionista vinculada.', 'NO_NUTRITIONIST');

  const [conv] = await Conversation.findOrCreate({
    where: { nutritionistId: profile.nutritionistId, patientProfileId: profile.id },
    defaults: { nutritionistId: profile.nutritionistId, patientProfileId: profile.id },
  });
  return conv;
}

// Lista as conversas do ator com prévia + não-lidas do seu lado.
async function listConversations(actor) {
  let where;
  if (actor.role === ROLES.NUTRITIONIST) {
    where = { nutritionistId: actor.id };
  } else if (actor.role === ROLES.PATIENT) {
    const profiles = await PatientProfile.findAll({ where: { userId: actor.id }, attributes: ['id'] });
    where = { patientProfileId: profiles.map((p) => p.id) };
  } else {
    where = {};
  }
  const convs = await Conversation.findAll({
    where,
    include: [
      { model: PatientProfile, as: 'patientProfile', include: [{ model: User, as: 'user', attributes: ['id', 'name'] }] },
      { model: User, as: 'nutritionist', attributes: ['id', 'name'] },
    ],
    order: [['lastMessageAt', 'DESC']],
  });
  const patientSide = actor.role === ROLES.PATIENT;
  return convs.map((c) => ({ ...c.toJSON(), unread: patientSide ? c.patientUnread : c.nutriUnread }));
}

async function listMessages(actor, conversationId, { before, limit = 50 } = {}) {
  const conv = await loadConversation(conversationId);
  assertParticipant(actor, conv);
  const where = { conversationId };
  if (before) where.createdAt = { [Op.lt]: before };
  const rows = await Message.findAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: Math.min(Number(limit) || 50, 100),
  });
  return rows.reverse(); // ordem ascendente para a UI
}

async function sendMessage(actor, conversationId, { type = 'text', body, attachmentUrl, attachmentName, attachmentSize, durationSec } = {}) {
  const conv = await loadConversation(conversationId);
  const side = assertParticipant(actor, conv);
  if (side === 'admin') throw AppError.forbidden('Admin não envia mensagens.', 'ADMIN_CANNOT_SEND');
  if (!Object.values(MESSAGE_TYPES).includes(type)) throw AppError.badRequest('type inválido.', 'INVALID_TYPE');
  if (type === MESSAGE_TYPES.TEXT && !(body && body.trim())) throw AppError.badRequest('Mensagem vazia.', 'EMPTY_MESSAGE');
  if (type !== MESSAGE_TYPES.TEXT && !attachmentUrl) throw AppError.badRequest('Anexo obrigatório.', 'MISSING_ATTACHMENT');

  // Se o anexo veio como base64 e o R2 está configurado, sobe para o storage e
  // guarda só a URL pública (em vez de inchar o banco com o base64).
  let finalAttachmentUrl = attachmentUrl || null;
  if (finalAttachmentUrl && finalAttachmentUrl.startsWith('data:') && storage.isEnabled()) {
    try {
      const uploaded = await storage.uploadDataUrl(finalAttachmentUrl, `chat/${conversationId}`);
      if (uploaded) finalAttachmentUrl = uploaded;
    } catch (e) {
      console.error('[messaging] upload R2 falhou, mantendo base64:', e.message);
    }
  }

  const message = await Message.create({
    conversationId,
    senderId: actor.id,
    type,
    body: body || null,
    attachmentUrl: finalAttachmentUrl,
    attachmentName: attachmentName || null,
    attachmentSize: attachmentSize || null,
    durationSec: durationSec || null,
  });

  const preview = previewFor(type, body);
  conv.lastMessageAt = new Date();
  conv.lastMessagePreview = preview;
  const recipientUserId = side === 'nutri' ? conv.patientProfile && conv.patientProfile.userId : conv.nutritionistId;
  if (side === 'nutri') conv.patientUnread += 1;
  else conv.nutriUnread += 1;
  await conv.save();

  if (recipientUserId) {
    emitToUser(recipientUserId, 'message:new', { conversationId, message: message.toJSON() });
    try {
      await notificationService.notify({
        userId: recipientUserId,
        title: 'Nova mensagem',
        message: preview || 'Você recebeu uma mensagem.',
        type: NOTIFICATION_TYPES.NEW_MESSAGE,
        metadata: { conversationId },
      });
    } catch (e) {
      console.error('[messaging] notify falhou', e);
    }
  }
  return message;
}

async function markRead(actor, conversationId) {
  const conv = await loadConversation(conversationId);
  const side = assertParticipant(actor, conv);
  await Message.update(
    { readAt: new Date() },
    { where: { conversationId, senderId: { [Op.ne]: actor.id }, readAt: null } },
  );
  if (side === 'nutri') conv.nutriUnread = 0;
  else if (side === 'patient') conv.patientUnread = 0;
  await conv.save();
  return { ok: true };
}

module.exports = { getOrCreate, listConversations, listMessages, sendMessage, markRead };
