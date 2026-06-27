// src/features/health-metric/health-metric.service.js — hábitos diários + Lifestyle Score.
// Upsert por (paciente, dia): registra hábitos, calcula o score e impede duplicidade.
const { Op } = require('sequelize');
const { DailyHealthMetric, PatientProfile } = require('../../models');
const AppError = require('../../utils/app-error');
const { ROLES } = require('../../config/constants');
const { computeScore } = require('./health-score');

// --- Autorização --------------------------------------------------------

async function loadProfile(patientProfileId) {
  const profile = await PatientProfile.findByPk(patientProfileId);
  if (!profile) throw AppError.notFound('Perfil de paciente não encontrado.', 'PROFILE_NOT_FOUND');
  return profile;
}

function assertAccess(actor, profile) {
  if (actor.role === ROLES.ADMIN) return;
  if (actor.role === ROLES.NUTRITIONIST && profile.nutritionistId === actor.id) return;
  if (actor.role === ROLES.PATIENT && profile.userId === actor.id) return;
  throw AppError.forbidden('Sem permissão sobre estas métricas.', 'HEALTH_METRIC_FORBIDDEN');
}

const METRIC_FIELDS = ['sleepHours', 'steps', 'waterMl', 'stressLevel', 'dietAdherence', 'trainedToday'];

function pickMetrics(data) {
  const out = {};
  METRIC_FIELDS.forEach((f) => {
    if (data[f] !== undefined) out[f] = data[f];
  });
  return out;
}

// --- Upsert diário ------------------------------------------------------

/**
 * Cria ou ATUALIZA a métrica do dia (unicidade por paciente+data) e calcula o score.
 */
async function upsertDaily(actor, { patientProfileId, date, ...rest }) {
  const profile = await loadProfile(patientProfileId);
  assertAccess(actor, profile);

  const day = date || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw AppError.badRequest('date deve estar no formato YYYY-MM-DD.', 'INVALID_DATE');
  }

  // Validação leve das escalas 1-10.
  ['stressLevel', 'dietAdherence'].forEach((f) => {
    if (rest[f] !== undefined && rest[f] !== null) {
      const v = Number(rest[f]);
      if (Number.isNaN(v) || v < 1 || v > 10) {
        throw AppError.badRequest(`${f} deve estar entre 1 e 10.`, 'INVALID_SCALE');
      }
    }
  });

  const existing = await DailyHealthMetric.findOne({ where: { patientProfileId, date: day } });
  const merged = {
    sleepHours: existing ? existing.sleepHours : null,
    steps: existing ? existing.steps : null,
    waterMl: existing ? existing.waterMl : null,
    stressLevel: existing ? existing.stressLevel : null,
    dietAdherence: existing ? existing.dietAdherence : null,
    trainedToday: existing ? existing.trainedToday : null,
    ...pickMetrics(rest), // novos valores sobrescrevem
  };
  const calculatedHealthScore = computeScore(merged);

  if (existing) {
    Object.assign(existing, merged, { calculatedHealthScore });
    await existing.save();
    return existing;
  }
  return DailyHealthMetric.create({ patientProfileId, date: day, ...merged, calculatedHealthScore });
}

// --- Consultas ----------------------------------------------------------

async function list(actor, { patientProfileId, from, to } = {}) {
  const profile = await loadProfile(patientProfileId);
  assertAccess(actor, profile);
  const where = { patientProfileId };
  if (from || to) {
    where.date = {};
    if (from) where.date[Op.gte] = from;
    if (to) where.date[Op.lte] = to;
  }
  return DailyHealthMetric.findAll({ where, order: [['date', 'DESC']] });
}

async function getByDate(actor, patientProfileId, date) {
  const profile = await loadProfile(patientProfileId);
  assertAccess(actor, profile);
  const metric = await DailyHealthMetric.findOne({ where: { patientProfileId, date } });
  if (!metric) throw AppError.notFound('Sem registro para a data.', 'HEALTH_METRIC_NOT_FOUND');
  return metric;
}

// Média do score num período (evolução do paciente).
async function summary(actor, { patientProfileId, from, to } = {}) {
  const metrics = await list(actor, { patientProfileId, from, to });
  const scored = metrics.filter((m) => m.calculatedHealthScore != null);
  const avg = scored.length
    ? Math.round(scored.reduce((acc, m) => acc + Number(m.calculatedHealthScore), 0) / scored.length)
    : null;
  return { days: metrics.length, scoredDays: scored.length, averageScore: avg };
}

module.exports = { upsertDaily, list, getByDate, summary };
