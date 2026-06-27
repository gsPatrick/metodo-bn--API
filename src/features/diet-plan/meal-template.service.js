// src/features/diet-plan/meal-template.service.js — modelos de refeição (pratos prontos).
// Otimização: macros do prato completo são PRÉ-COMPUTADOS e persistidos; o
// carregamento usa include em lote (uma query traz template + itens + alimentos),
// evitando dezenas de conexões individuais ao reutilizar combinações frequentes.
const { Op } = require('sequelize');
const { MealTemplate, MealTemplateItem, Food, sequelize } = require('../../models');
const AppError = require('../../utils/app-error');
const { ROLES } = require('../../config/constants');

function assertOwner(actor, template) {
  if (!template) throw AppError.notFound('Modelo de refeição não encontrado.', 'TEMPLATE_NOT_FOUND');
  if (actor.role === ROLES.ADMIN) return;
  if (template.nutritionistId === actor.id) return;
  throw AppError.forbidden('Sem permissão sobre este modelo.', 'TEMPLATE_FORBIDDEN');
}

// Soma macros dos itens a partir do catálogo (proporcional para g/ml por 100).
function computeTotals(items, foodsById) {
  const totals = { totalKcal: 0, totalCarbsG: 0, totalProteinG: 0, totalFatG: 0 };
  for (const item of items) {
    const food = item.foodId ? foodsById.get(item.foodId) : null;
    if (!food) continue;
    const unit = (item.unit || 'g').toLowerCase();
    const factor = unit === 'g' || unit === 'ml' ? Number(item.quantity) / 100 : 0;
    totals.totalKcal += Number(food.kcal) * factor;
    totals.totalCarbsG += Number(food.carbsG) * factor;
    totals.totalProteinG += Number(food.proteinG) * factor;
    totals.totalFatG += Number(food.fatG) * factor;
  }
  const r = (n) => Math.round(n * 100) / 100;
  return { totalKcal: r(totals.totalKcal), totalCarbsG: r(totals.totalCarbsG), totalProteinG: r(totals.totalProteinG), totalFatG: r(totals.totalFatG) };
}

// Carrega em lote os alimentos referenciados pelos itens (uma query).
async function loadFoodsById(items, transaction) {
  const ids = [...new Set(items.map((i) => i.foodId).filter(Boolean))];
  if (!ids.length) return new Map();
  const foods = await Food.findAll({ where: { id: { [Op.in]: ids } }, transaction });
  return new Map(foods.map((f) => [f.id, f]));
}

async function list(actor) {
  const where = actor.role === ROLES.ADMIN ? {} : { nutritionistId: actor.id };
  return MealTemplate.findAll({
    where,
    order: [['usageCount', 'DESC'], ['name', 'ASC']],
    include: [{ model: MealTemplateItem, as: 'items', include: [{ model: Food, as: 'food' }] }],
  });
}

async function getById(actor, id) {
  const template = await MealTemplate.findByPk(id, {
    include: [{ model: MealTemplateItem, as: 'items', include: [{ model: Food, as: 'food' }] }],
  });
  assertOwner(actor, template);
  return template;
}

async function create(actor, { name, description, preferredTime, items = [] }) {
  if (actor.role !== ROLES.NUTRITIONIST && actor.role !== ROLES.ADMIN) {
    throw AppError.forbidden('Apenas nutricionistas criam modelos.', 'NOT_NUTRITIONIST');
  }
  if (!name || !Array.isArray(items) || !items.length) {
    throw AppError.badRequest('name e ao menos um item são obrigatórios.', 'MISSING_FIELDS');
  }

  return sequelize.transaction(async (t) => {
    const foodsById = await loadFoodsById(items, t);
    const totals = computeTotals(items, foodsById);

    const template = await MealTemplate.create(
      { nutritionistId: actor.id, name, description: description ?? null, preferredTime: preferredTime ?? null, ...totals },
      { transaction: t },
    );

    await MealTemplateItem.bulkCreate(
      items.map((it, idx) => ({
        mealTemplateId: template.id,
        foodId: it.foodId ?? null,
        customFoodName: it.customFoodName ?? null,
        quantity: it.quantity ?? 0,
        unit: it.unit ?? 'g',
        sortOrder: it.sortOrder ?? idx,
      })),
      { transaction: t, validate: true },
    );

    return getById(actor, template.id);
  });
}

async function remove(actor, id) {
  const template = await MealTemplate.findByPk(id);
  assertOwner(actor, template);
  await template.destroy();
  return { deleted: true };
}

module.exports = { list, getById, create, remove, assertOwner, computeTotals, loadFoodsById };
