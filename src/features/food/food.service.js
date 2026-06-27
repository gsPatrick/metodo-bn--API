// src/features/food/food.service.js — catálogo de alimentos (TACO/TBCA + custom).
// Busca rápida (ILIKE, índice pg_trgm), RBAC de visibilidade, alimentos
// personalizados da nutricionista e ranking de populares com cache em memória.
const { Op } = require('sequelize');
const { Food, PatientProfile } = require('../../models');
const AppError = require('../../utils/app-error');
const { ROLES } = require('../../config/constants');
const env = require('../../config/env');
const { cache, popularKey, invalidatePopular } = require('./food.cache');

// Resolve qual nutricionista define os alimentos custom visíveis ao ator.
// - admin: vê tudo (retorna null → sem filtro de dono).
// - nutritionist: seus próprios custom.
// - patient: os custom da sua nutricionista.
async function resolveScopeNutritionistId(actor) {
  if (actor.role === ROLES.ADMIN) return { admin: true, nutritionistId: null };
  if (actor.role === ROLES.NUTRITIONIST) return { admin: false, nutritionistId: actor.id };
  // patient
  const profile = await PatientProfile.findOne({ where: { userId: actor.id } });
  return { admin: false, nutritionistId: profile ? profile.nutritionistId : null };
}

// Monta o WHERE de visibilidade: públicos + custom do escopo.
function visibilityWhere({ admin, nutritionistId }) {
  if (admin) return { isActive: true };
  const orVisible = [{ isCustom: false }];
  if (nutritionistId) orVisible.push({ createdByNutritionistId: nutritionistId });
  return { isActive: true, [Op.or]: orVisible };
}

// --------------------------------------------------------------- busca
async function search(actor, { q, category, source, limit = 20, offset = 0 } = {}) {
  const scope = await resolveScopeNutritionistId(actor);
  const where = { ...visibilityWhere(scope) };

  if (q) where.name = { [Op.iLike]: `%${q}%` }; // pg_trgm acelera o ILIKE parcial
  if (category) where.category = category;
  if (source) where.source = source;

  const { rows, count } = await Food.findAndCountAll({
    where,
    order: [
      ['usageCount', 'DESC'], // mais usados primeiro
      ['name', 'ASC'],
    ],
    limit: Math.min(Number(limit) || 20, 100),
    offset: Number(offset) || 0,
  });
  return { items: rows, total: count };
}

async function getById(actor, id) {
  const scope = await resolveScopeNutritionistId(actor);
  const food = await Food.findOne({ where: { id, ...visibilityWhere(scope) } });
  if (!food) throw AppError.notFound('Alimento não encontrado.', 'FOOD_NOT_FOUND');
  return food;
}

// -------------------------------------------------------- populares (cache)
async function getPopular(actor) {
  const scope = await resolveScopeNutritionistId(actor);
  const scopeKey = scope.admin ? 'admin' : scope.nutritionistId || 'public';
  const key = popularKey(scopeKey);

  const cached = cache.get(key);
  if (cached) return cached;

  const rows = await Food.findAll({
    where: visibilityWhere(scope),
    order: [['usageCount', 'DESC'], ['name', 'ASC']],
    limit: env.FOOD_POPULAR_LIMIT,
  });
  cache.set(key, rows, env.FOOD_CACHE_TTL_SECONDS);
  return rows;
}

// Candidatos para a IA (catálogo do escopo, priorizando populares).
async function getCandidatesForAI(scope, max = 60) {
  return Food.findAll({
    where: visibilityWhere(scope),
    order: [['usageCount', 'DESC'], ['name', 'ASC']],
    limit: max,
  });
}

// ---------------------------------------------------- alimentos custom
async function createCustom(actor, data) {
  if (actor.role !== ROLES.NUTRITIONIST && actor.role !== ROLES.ADMIN) {
    throw AppError.forbidden('Apenas nutricionistas criam alimentos.', 'NOT_NUTRITIONIST');
  }
  if (!data.name) throw AppError.badRequest('name é obrigatório.', 'MISSING_FIELDS');

  const food = await Food.create({
    name: data.name,
    source: data.source || 'CUSTOM',
    category: data.category ?? null,
    kcal: data.kcal ?? 0,
    carbsG: data.carbsG ?? 0,
    proteinG: data.proteinG ?? 0,
    fatG: data.fatG ?? 0,
    fiberG: data.fiberG ?? 0,
    sodiumMg: data.sodiumMg ?? 0,
    isCustom: true,
    createdByNutritionistId: actor.id,
  });
  invalidatePopular();
  return food;
}

async function loadOwnedCustom(actor, id) {
  const food = await Food.findByPk(id);
  if (!food || !food.isCustom) throw AppError.notFound('Alimento custom não encontrado.', 'FOOD_NOT_FOUND');
  if (actor.role !== ROLES.ADMIN && food.createdByNutritionistId !== actor.id) {
    throw AppError.forbidden('Sem permissão sobre este alimento.', 'FOOD_FORBIDDEN');
  }
  return food;
}

const CUSTOM_FIELDS = ['name', 'category', 'kcal', 'carbsG', 'proteinG', 'fatG', 'fiberG', 'sodiumMg', 'isActive'];

async function updateCustom(actor, id, data) {
  const food = await loadOwnedCustom(actor, id);
  CUSTOM_FIELDS.forEach((f) => {
    if (data[f] !== undefined) food[f] = data[f];
  });
  await food.save();
  invalidatePopular();
  return food;
}

async function removeCustom(actor, id) {
  const food = await loadOwnedCustom(actor, id);
  await food.destroy();
  invalidatePopular();
  return { deleted: true };
}

// Incrementa o contador de uso de vários alimentos (chamado ao usar em dietas/busca).
async function incrementUsage(foodIds = []) {
  const ids = [...new Set(foodIds)].filter(Boolean);
  if (!ids.length) return;
  await Food.increment('usageCount', { by: 1, where: { id: { [Op.in]: ids } } });
  invalidatePopular(); // ranking mudou
}

module.exports = {
  search,
  getById,
  getPopular,
  getCandidatesForAI,
  resolveScopeNutritionistId,
  createCustom,
  updateCustom,
  removeCustom,
  incrementUsage,
};
