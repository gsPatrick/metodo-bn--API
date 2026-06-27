// src/features/achievement/achievement.service.js — conquistas/badges do paciente.
const { PatientAchievement, PatientProfile } = require('../../models');
const AppError = require('../../utils/app-error');
const { ROLES, ACHIEVEMENTS } = require('../../config/constants');

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
  throw AppError.forbidden('Sem permissão sobre estas conquistas.', 'ACHIEVEMENT_FORBIDDEN');
}

// Catálogo (estático) + conquistas já desbloqueadas pelo paciente.
async function list(actor, patientProfileId) {
  const profile = await loadProfile(patientProfileId);
  assertAccess(actor, profile);
  const unlocked = await PatientAchievement.findAll({ where: { patientProfileId }, order: [['unlockedAt', 'DESC']] });
  const unlockedCodes = new Set(unlocked.map((u) => u.code));
  const catalog = Object.values(ACHIEVEMENTS).map((a) => ({
    ...a,
    unlocked: unlockedCodes.has(a.code),
    unlockedAt: (unlocked.find((u) => u.code === a.code) || {}).unlockedAt || null,
  }));
  return { catalog, unlocked };
}

// Desbloqueia uma conquista (idempotente).
async function unlock(actor, { patientProfileId, code }) {
  const profile = await loadProfile(patientProfileId);
  assertAccess(actor, profile);
  if (!ACHIEVEMENTS[code]) throw AppError.badRequest('Conquista inválida.', 'INVALID_ACHIEVEMENT');
  const [row, createdNow] = await PatientAchievement.findOrCreate({
    where: { patientProfileId, code },
    defaults: { patientProfileId, code },
  });
  return { achievement: row, isNew: createdNow };
}

module.exports = { list, unlock };
