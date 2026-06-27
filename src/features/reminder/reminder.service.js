// src/features/reminder/reminder.service.js — lembretes do paciente.
const { Reminder, PatientProfile } = require('../../models');
const AppError = require('../../utils/app-error');
const { ROLES, REMINDER_TYPES } = require('../../config/constants');

async function loadProfile(patientProfileId) {
  if (!patientProfileId) throw AppError.badRequest('patientProfileId é obrigatório.', 'MISSING_PROFILE');
  const profile = await PatientProfile.findByPk(patientProfileId);
  if (!profile) throw AppError.notFound('Perfil de paciente não encontrado.', 'PROFILE_NOT_FOUND');
  return profile;
}
function assertAccess(actor, profile) {
  if (actor.role === ROLES.ADMIN) return;
  if (actor.role === ROLES.NUTRITIONIST && profile.nutritionistId === actor.id) return;
  if (actor.role === ROLES.PATIENT && profile.userId === actor.id) return;
  throw AppError.forbidden('Sem permissão sobre estes lembretes.', 'REMINDER_FORBIDDEN');
}

async function list(actor, patientProfileId) {
  const profile = await loadProfile(patientProfileId);
  assertAccess(actor, profile);
  return Reminder.findAll({ where: { patientProfileId }, order: [['timeOfDay', 'ASC']] });
}

async function create(actor, { patientProfileId, type = 'custom', title, timeOfDay, enabled = true }) {
  const profile = await loadProfile(patientProfileId);
  assertAccess(actor, profile);
  if (!title) throw AppError.badRequest('title é obrigatório.', 'MISSING_TITLE');
  const safeType = Object.values(REMINDER_TYPES).includes(type) ? type : 'custom';
  return Reminder.create({ patientProfileId, type: safeType, title, timeOfDay: timeOfDay || null, enabled });
}

async function update(actor, reminderId, patch = {}) {
  const reminder = await Reminder.findByPk(reminderId);
  if (!reminder) throw AppError.notFound('Lembrete não encontrado.', 'REMINDER_NOT_FOUND');
  const profile = await loadProfile(reminder.patientProfileId);
  assertAccess(actor, profile);
  ['title', 'type', 'timeOfDay', 'enabled'].forEach((f) => {
    if (patch[f] !== undefined) reminder[f] = patch[f];
  });
  await reminder.save();
  return reminder;
}

async function remove(actor, reminderId) {
  const reminder = await Reminder.findByPk(reminderId);
  if (!reminder) throw AppError.notFound('Lembrete não encontrado.', 'REMINDER_NOT_FOUND');
  const profile = await loadProfile(reminder.patientProfileId);
  assertAccess(actor, profile);
  await reminder.destroy();
  return { ok: true };
}

module.exports = { list, create, update, remove };
