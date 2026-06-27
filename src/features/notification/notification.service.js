// src/features/notification/notification.service.js — centraliza notificações.
// Persiste no banco e dispara eventos em tempo real via Socket.io.
// É o ponto único de envio: outras features chamam `notify()` / `notifyMany()`.
const { Op } = require('sequelize');
const { Notification, User } = require('../../models');
const AppError = require('../../utils/app-error');
const { NOTIFICATION_TYPES, values } = require('../../config/constants');
const { emitToUser } = require('../../providers/websocket/socket-server');

const VALID_TYPES = values(NOTIFICATION_TYPES);

// Emite os eventos de tempo real associados a uma notificação nova.
async function pushRealtime(userId, notification) {
  emitToUser(userId, 'notification:new', notification.toJSON());
  const count = await getUnreadCount(userId);
  emitToUser(userId, 'notification:unread_count', { count });
}

// --------------------------------------------------------------- consultas
async function listForUser(userId, { onlyUnread = false, limit = 50, offset = 0 } = {}) {
  const where = { userId };
  if (onlyUnread) where.isRead = false;
  const { rows, count } = await Notification.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: Math.min(Number(limit) || 50, 100),
    offset: Number(offset) || 0,
  });
  return { items: rows, total: count };
}

async function getUnreadCount(userId) {
  return Notification.count({ where: { userId, isRead: false } });
}

// ---------------------------------------------------------------- criação
// Cria a notificação, persiste e dispara o evento WebSocket ao destinatário.
async function notify({ userId, title, message, type, metadata = null }) {
  if (!userId || !title || !message) {
    throw AppError.badRequest('userId, title e message são obrigatórios.', 'MISSING_FIELDS');
  }
  const finalType = type && VALID_TYPES.includes(type) ? type : NOTIFICATION_TYPES.SYSTEM_ALERT;

  const notification = await Notification.create({
    userId,
    title,
    message,
    type: finalType,
    metadata,
  });

  await pushRealtime(userId, notification);
  return notification;
}

// Envia a mesma notificação para vários destinatários (ex: broadcast da nutri).
async function notifyMany(userIds, { title, message, type, metadata = null }) {
  const unique = [...new Set(userIds)].filter(Boolean);
  const results = await Promise.all(
    unique.map((userId) =>
      notify({ userId, title, message, type, metadata }).catch((e) => {
        console.error('[notification] notifyMany falhou para', userId, e);
        return null;
      }),
    ),
  );
  return results.filter(Boolean);
}

// Envio manual a partir de um ator (admin/nutricionista) — valida destinatário.
async function sendToUser(actor, { userId, title, message, type, metadata }) {
  const target = await User.findByPk(userId);
  if (!target) throw AppError.notFound('Destinatário não encontrado.', 'USER_NOT_FOUND');
  return notify({ userId, title, message, type, metadata });
}

// ------------------------------------------------------------- mudança de estado
async function markAsRead(userId, id) {
  const notification = await Notification.findOne({ where: { id, userId } });
  if (!notification) throw AppError.notFound('Notificação não encontrada.', 'NOTIFICATION_NOT_FOUND');
  if (!notification.isRead) {
    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();
    emitToUser(userId, 'notification:unread_count', { count: await getUnreadCount(userId) });
  }
  return notification;
}

async function markAllRead(userId) {
  const [count] = await Notification.update(
    { isRead: true, readAt: new Date() },
    { where: { userId, isRead: false } },
  );
  emitToUser(userId, 'notification:unread_count', { count: 0 });
  return { updated: count };
}

async function remove(userId, id) {
  const notification = await Notification.findOne({ where: { id, userId } });
  if (!notification) throw AppError.notFound('Notificação não encontrada.', 'NOTIFICATION_NOT_FOUND');
  await notification.destroy();
  emitToUser(userId, 'notification:unread_count', { count: await getUnreadCount(userId) });
  return { deleted: true };
}

// Limpeza opcional de notificações lidas antigas (uso por job/cron).
async function purgeReadOlderThan(days = 90) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return Notification.destroy({ where: { isRead: true, createdAt: { [Op.lt]: cutoff } } });
}

module.exports = {
  listForUser,
  getUnreadCount,
  notify,
  notifyMany,
  sendToUser,
  markAsRead,
  markAllRead,
  remove,
  purgeReadOlderThan,
};
