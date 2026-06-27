// src/features/meal-log/meal-log.service.js — registro diário de consumo do plano.
// O paciente marca por item: consumiu / trocou / não consumiu; e adiciona extras
// ("comeu a mais"). A nutri lê o mesmo recurso (RBAC por perfil).
const { MealLog, MealExtra, PatientProfile } = require('../../models');
const AppError = require('../../utils/app-error');
const { ROLES, MEAL_LOG_STATUS } = require('../../config/constants');

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
  throw AppError.forbidden('Sem permissão sobre este registro.', 'MEAL_LOG_FORBIDDEN');
}

const today = () => new Date().toISOString().slice(0, 10);
const validDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);

// Lista o dia: itens marcados + extras.
async function listDay(actor, patientProfileId, date) {
  const profile = await loadProfile(patientProfileId);
  assertAccess(actor, profile);
  const day = date || today();
  if (!validDate(day)) throw AppError.badRequest('date inválida.', 'INVALID_DATE');
  const [logs, extras] = await Promise.all([
    MealLog.findAll({ where: { patientProfileId, date: day } }),
    MealExtra.findAll({ where: { patientProfileId, date: day }, order: [['createdAt', 'ASC']] }),
  ]);
  return { date: day, logs, extras };
}

// Upsert do status de um item do plano no dia.
async function setItem(actor, { patientProfileId, date, mealItemId, status, swappedFoodId, swappedFoodName }) {
  const profile = await loadProfile(patientProfileId);
  assertAccess(actor, profile);
  if (!mealItemId) throw AppError.badRequest('mealItemId é obrigatório.', 'MISSING_MEAL_ITEM');
  if (!Object.values(MEAL_LOG_STATUS).includes(status)) {
    throw AppError.badRequest('status deve ser consumed | swapped | skipped.', 'INVALID_STATUS');
  }
  const day = date || today();
  if (!validDate(day)) throw AppError.badRequest('date inválida.', 'INVALID_DATE');

  const [row] = await MealLog.findOrCreate({
    where: { patientProfileId, date: day, mealItemId },
    defaults: { status },
  });
  row.status = status;
  const swapped = status === MEAL_LOG_STATUS.SWAPPED;
  row.swappedFoodId = swapped ? swappedFoodId || null : null;
  row.swappedFoodName = swapped ? swappedFoodName || null : null;
  await row.save();
  return row;
}

// Remove o registro de um item (volta a "pendente").
async function clearItem(actor, patientProfileId, date, mealItemId) {
  const profile = await loadProfile(patientProfileId);
  assertAccess(actor, profile);
  const day = date || today();
  await MealLog.destroy({ where: { patientProfileId, date: day, mealItemId } });
  return { ok: true };
}

// Adiciona um extra ("comeu a mais").
async function addExtra(actor, { patientProfileId, date, mealId, foodId, foodName, quantityG, kcal, carbsG, proteinG, fatG }) {
  const profile = await loadProfile(patientProfileId);
  assertAccess(actor, profile);
  if (!foodName) throw AppError.badRequest('foodName é obrigatório.', 'MISSING_FOOD_NAME');
  const day = date || today();
  if (!validDate(day)) throw AppError.badRequest('date inválida.', 'INVALID_DATE');
  return MealExtra.create({
    patientProfileId,
    date: day,
    mealId: mealId || null,
    foodId: foodId || null,
    foodName,
    quantityG: quantityG ?? null,
    kcal: kcal ?? null,
    carbsG: carbsG ?? null,
    proteinG: proteinG ?? null,
    fatG: fatG ?? null,
  });
}

async function removeExtra(actor, patientProfileId, extraId) {
  const profile = await loadProfile(patientProfileId);
  assertAccess(actor, profile);
  const extra = await MealExtra.findByPk(extraId);
  if (!extra || extra.patientProfileId !== patientProfileId) {
    throw AppError.notFound('Extra não encontrado.', 'EXTRA_NOT_FOUND');
  }
  await extra.destroy();
  return { ok: true };
}

module.exports = { listDay, setItem, clearItem, addExtra, removeExtra };
