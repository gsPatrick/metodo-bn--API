// src/features/shopping-list/shopping-list.service.js — geração e gestão de listas.
// Agrega o plano aprovado em uma lista consolidada (soma quantidades de itens
// idênticos), categoriza por gôndola e gerencia o checklist do paciente.
const {
  ShoppingList,
  ShoppingListItem,
  DietPlan,
  Meal,
  MealItem,
  Food,
  PatientProfile,
  sequelize,
} = require('../../models');
const AppError = require('../../utils/app-error');
const { ROLES, DIET_PLAN_STATUS, SHOPPING_LIST_STATUS } = require('../../config/constants');
const { categorize } = require('./categorizer');

// --- Autorização --------------------------------------------------------

async function loadProfile(patientProfileId) {
  const profile = await PatientProfile.findByPk(patientProfileId);
  if (!profile) throw AppError.notFound('Perfil de paciente não encontrado.', 'PROFILE_NOT_FOUND');
  return profile;
}

function assertProfileAccess(actor, profile) {
  if (actor.role === ROLES.ADMIN) return;
  if (actor.role === ROLES.NUTRITIONIST && profile.nutritionistId === actor.id) return;
  if (actor.role === ROLES.PATIENT && profile.userId === actor.id) return;
  throw AppError.forbidden('Sem permissão sobre esta lista.', 'SHOPPING_LIST_FORBIDDEN');
}

// Carrega lista + perfil e valida acesso.
async function loadListForActor(actor, id, { withItems = true } = {}) {
  const include = withItems ? [{ model: ShoppingListItem, as: 'items' }] : [];
  const list = await ShoppingList.findByPk(id, {
    include: [{ model: PatientProfile, as: 'patient' }, ...include],
  });
  if (!list) throw AppError.notFound('Lista não encontrada.', 'SHOPPING_LIST_NOT_FOUND');
  assertProfileAccess(actor, list.patient);
  return list;
}

// --- Geração a partir do plano aprovado --------------------------------

async function generateFromActivePlan(actor, { patientProfileId, dietPlanId, title }) {
  const profile = await loadProfile(patientProfileId);
  assertProfileAccess(actor, profile);

  const where = { patientProfileId, status: DIET_PLAN_STATUS.APPROVED };
  if (dietPlanId) where.id = dietPlanId;
  const plan = await DietPlan.findOne({
    where,
    order: [['approvedAt', 'DESC']],
    include: [
      {
        model: Meal,
        as: 'meals',
        include: [{ model: MealItem, as: 'items', include: [{ model: Food, as: 'food' }] }],
      },
    ],
  });
  if (!plan) throw AppError.notFound('Nenhum plano aprovado encontrado para o paciente.', 'NO_APPROVED_PLAN');

  // Consolidação: soma quantidades por (alimento|nome + unidade).
  const agg = new Map();
  for (const meal of plan.meals || []) {
    for (const item of meal.items || []) {
      const food = item.food;
      const unit = (item.unit || 'g').toLowerCase();
      const name = food ? food.name : (item.customFoodName || 'Item');
      const key = food ? `food:${food.id}:${unit}` : `name:${name.toLowerCase()}:${unit}`;
      const qty = Number(item.quantity) || 0;
      const existing = agg.get(key);
      if (existing) {
        existing.quantity += qty;
      } else {
        agg.set(key, {
          foodId: food ? food.id : null,
          name,
          category: categorize({ name, foodCategory: food ? food.category : null }),
          quantity: qty,
          unit,
        });
      }
    }
  }
  if (!agg.size) throw AppError.badRequest('O plano não possui itens para gerar a lista.', 'EMPTY_PLAN');

  const id = await sequelize.transaction(async (t) => {
    // Mantém uma única lista ativa: arquiva as anteriores.
    await ShoppingList.update(
      { status: SHOPPING_LIST_STATUS.ARCHIVED },
      { where: { patientProfileId, status: SHOPPING_LIST_STATUS.ACTIVE }, transaction: t },
    );

    const list = await ShoppingList.create(
      {
        patientProfileId,
        dietPlanId: plan.id,
        title: title || `Lista — ${plan.title}`,
        status: SHOPPING_LIST_STATUS.ACTIVE,
      },
      { transaction: t },
    );

    const rows = [...agg.values()]
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
      .map((i) => ({
        shoppingListId: list.id,
        foodId: i.foodId,
        name: i.name,
        category: i.category,
        quantity: Math.round(i.quantity * 100) / 100,
        unit: i.unit,
        isChecked: false,
      }));
    await ShoppingListItem.bulkCreate(rows, { transaction: t });
    return list.id;
  });

  return getById(actor, id);
}

// --- Consultas ----------------------------------------------------------

async function list(actor, { patientProfileId, status } = {}) {
  const where = {};
  if (status) where.status = status;

  if (actor.role === ROLES.PATIENT) {
    const profile = await PatientProfile.findOne({ where: { userId: actor.id } });
    if (!profile) return [];
    where.patientProfileId = profile.id;
  } else if (actor.role === ROLES.NUTRITIONIST) {
    // Restringe aos pacientes da nutricionista.
    if (patientProfileId) {
      const profile = await loadProfile(patientProfileId);
      assertProfileAccess(actor, profile);
      where.patientProfileId = patientProfileId;
    } else {
      const patients = await PatientProfile.findAll({ where: { nutritionistId: actor.id }, attributes: ['id'] });
      where.patientProfileId = patients.map((p) => p.id);
    }
  } else if (patientProfileId) {
    where.patientProfileId = patientProfileId;
  }

  return ShoppingList.findAll({ where, order: [['createdAt', 'DESC']] });
}

async function getById(actor, id) {
  const list = await loadListForActor(actor, id);
  // Ordena itens por gôndola e nome para exibição.
  if (list.items) {
    list.items.sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name));
  }
  return list;
}

// --- Edição de itens / checklist ---------------------------------------

async function loadItemForActor(actor, itemId) {
  const item = await ShoppingListItem.findByPk(itemId, {
    include: [{ model: ShoppingList, as: 'list', include: [{ model: PatientProfile, as: 'patient' }] }],
  });
  if (!item) throw AppError.notFound('Item não encontrado.', 'SHOPPING_ITEM_NOT_FOUND');
  assertProfileAccess(actor, item.list.patient);
  return item;
}

// Marca/desmarca item do checklist.
async function toggleItem(actor, itemId, isChecked) {
  const item = await loadItemForActor(actor, itemId);
  item.isChecked = Boolean(isChecked);
  await item.save();
  return item;
}

async function addItem(actor, listId, data) {
  const list = await loadListForActor(actor, listId, { withItems: false });
  if (!data.name) throw AppError.badRequest('name é obrigatório.', 'MISSING_FIELDS');
  return ShoppingListItem.create({
    shoppingListId: list.id,
    foodId: data.foodId ?? null,
    name: data.name,
    category: data.category || categorize({ name: data.name }),
    quantity: data.quantity ?? 1,
    unit: data.unit ?? 'un',
    isChecked: false,
    price: data.price ?? null,
  });
}

async function updateItem(actor, itemId, data) {
  const item = await loadItemForActor(actor, itemId);
  ['name', 'category', 'quantity', 'unit', 'isChecked', 'price'].forEach((f) => {
    if (data[f] !== undefined) item[f] = data[f];
  });
  await item.save();
  return item;
}

async function removeItem(actor, itemId) {
  const item = await loadItemForActor(actor, itemId);
  await item.destroy();
  return { deleted: true };
}

async function setStatus(actor, id, status) {
  if (!Object.values(SHOPPING_LIST_STATUS).includes(status)) {
    throw AppError.badRequest('Status inválido.', 'INVALID_STATUS');
  }
  const list = await loadListForActor(actor, id, { withItems: false });
  list.status = status;
  if (status === SHOPPING_LIST_STATUS.COMPLETED) list.completedAt = new Date();
  await list.save();
  return list;
}

module.exports = {
  generateFromActivePlan,
  list,
  getById,
  toggleItem,
  addItem,
  updateItem,
  removeItem,
  setStatus,
  loadListForActor,
  assertProfileAccess,
  loadProfile,
};
