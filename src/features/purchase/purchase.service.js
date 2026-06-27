// src/features/purchase/purchase.service.js — Modo Compra, orçamento e histórico.
// Sessão de compra em tempo real sobre uma ShoppingList ativa: checklist + preço,
// alerta de teto de gastos e, ao finalizar, persistência transacional do histórico
// (PurchaseHistory + PurchaseItemDetail) como base do comparador de preços.
const { Op } = require('sequelize');
const {
  ShoppingList,
  ShoppingListItem,
  PatientProfile,
  PurchaseHistory,
  PurchaseItemDetail,
  Market,
  sequelize,
} = require('../../models');
const AppError = require('../../utils/app-error');
const { ROLES, SHOPPING_LIST_STATUS } = require('../../config/constants');

// --- Autorização --------------------------------------------------------

function assertProfileAccess(actor, profile) {
  if (actor.role === ROLES.ADMIN) return;
  if (actor.role === ROLES.NUTRITIONIST && profile.nutritionistId === actor.id) return;
  if (actor.role === ROLES.PATIENT && profile.userId === actor.id) return;
  throw AppError.forbidden('Sem permissão sobre esta compra.', 'PURCHASE_FORBIDDEN');
}

async function loadListWithItems(actor, shoppingListId) {
  const list = await ShoppingList.findByPk(shoppingListId, {
    include: [
      { model: PatientProfile, as: 'patient' },
      { model: ShoppingListItem, as: 'items' },
    ],
  });
  if (!list) throw AppError.notFound('Lista não encontrada.', 'SHOPPING_LIST_NOT_FOUND');
  assertProfileAccess(actor, list.patient);
  return list;
}

// Resolve os perfis acessíveis ao ator (para histórico/comparador).
async function resolveScopeProfileIds(actor, patientProfileId) {
  if (actor.role === ROLES.ADMIN) return patientProfileId ? [patientProfileId] : null; // null = todos
  if (actor.role === ROLES.PATIENT) {
    const profile = await PatientProfile.findOne({ where: { userId: actor.id } });
    return profile ? [profile.id] : [];
  }
  // nutritionist
  if (patientProfileId) {
    const profile = await PatientProfile.findByPk(patientProfileId);
    if (!profile) throw AppError.notFound('Perfil não encontrado.', 'PROFILE_NOT_FOUND');
    assertProfileAccess(actor, profile);
    return [patientProfileId];
  }
  const patients = await PatientProfile.findAll({ where: { nutritionistId: actor.id }, attributes: ['id'] });
  return patients.map((p) => p.id);
}

// --- Resumo da sessão (com alerta de orçamento) -------------------------

function num(v) {
  return v == null ? null : Number(v);
}

function buildSummary(list, extra = {}) {
  const items = list.items || [];
  const withPrice = items.filter((i) => i.price != null);
  const runningTotal = withPrice.reduce((acc, i) => acc + Number(i.price), 0);

  // Orçamento: o da sessão (list.budget) tem prioridade sobre o do perfil.
  const budget =
    num(list.budget) != null ? num(list.budget) : num(list.patient && list.patient.shoppingBudget);

  const round = (n) => Math.round(n * 100) / 100;
  return {
    shoppingListId: list.id,
    status: list.status,
    totalItems: items.length,
    checkedItems: items.filter((i) => i.isChecked).length,
    itemsWithPrice: withPrice.length,
    runningTotal: round(runningTotal),
    budget,
    // ALERTA: teto de gastos estourado.
    budgetExceeded: budget != null && runningTotal > budget,
    remaining: budget != null ? round(budget - runningTotal) : null,
    ...extra,
  };
}

// --- Sessão do Modo Compra ---------------------------------------------

// Inicia a sessão: define (opcionalmente) o orçamento e devolve o resumo.
async function startSession(actor, { shoppingListId, budget, marketId }) {
  const list = await loadListWithItems(actor, shoppingListId);
  if (list.status === SHOPPING_LIST_STATUS.COMPLETED) {
    throw AppError.badRequest('Lista já finalizada.', 'LIST_ALREADY_COMPLETED');
  }
  if (budget !== undefined) {
    list.budget = budget;
    await list.save();
  }
  return buildSummary(list, { marketId: marketId ?? null });
}

async function getSession(actor, shoppingListId) {
  const list = await loadListWithItems(actor, shoppingListId);
  return buildSummary(list);
}

// Marca item e registra preço unitário em tempo real → resumo com alerta.
async function checkItem(actor, itemId, { isChecked, price }) {
  const item = await ShoppingListItem.findByPk(itemId, {
    include: [{ model: ShoppingList, as: 'list', include: [{ model: PatientProfile, as: 'patient' }] }],
  });
  if (!item) throw AppError.notFound('Item não encontrado.', 'SHOPPING_ITEM_NOT_FOUND');
  assertProfileAccess(actor, item.list.patient);
  if (item.list.status === SHOPPING_LIST_STATUS.COMPLETED) {
    throw AppError.badRequest('Lista já finalizada.', 'LIST_ALREADY_COMPLETED');
  }

  if (isChecked !== undefined) item.isChecked = Boolean(isChecked);
  if (price !== undefined) item.price = price; // null limpa o preço
  await item.save();

  // Recarrega a lista completa para recomputar o total acumulado.
  const list = await loadListWithItems(actor, item.shoppingListId);
  return { item, summary: buildSummary(list) };
}

// --- Finalização (persistência do histórico) ----------------------------

async function finalize(actor, { shoppingListId, marketId, notes }) {
  const list = await loadListWithItems(actor, shoppingListId);
  if (list.status === SHOPPING_LIST_STATUS.COMPLETED) {
    throw AppError.badRequest('Lista já finalizada.', 'LIST_ALREADY_COMPLETED');
  }

  if (marketId) {
    const market = await Market.findByPk(marketId);
    if (!market) throw AppError.notFound('Mercado não encontrado.', 'MARKET_NOT_FOUND');
  }

  const itemsWithPrice = (list.items || []).filter((i) => i.price != null);
  const totalAmount = itemsWithPrice.reduce((acc, i) => acc + Number(i.price), 0);

  const purchaseId = await sequelize.transaction(async (t) => {
    // 1. Conclui a lista de origem.
    list.status = SHOPPING_LIST_STATUS.COMPLETED;
    list.completedAt = new Date();
    await list.save({ transaction: t });

    // 2. Cabeçalho da compra.
    const purchase = await PurchaseHistory.create(
      {
        patientProfileId: list.patientProfileId,
        shoppingListId: list.id,
        marketId: marketId ?? null,
        totalAmount: Math.round(totalAmount * 100) / 100,
        purchasedAt: new Date(),
        notes: notes ?? null,
      },
      { transaction: t },
    );

    // 3. Detalhe por item (motor do comparador de preços).
    //    `price` informado = total pago na linha → subtotal; unitPrice normalizado
    //    por quantidade (preço por unidade de medida), útil ao comparador futuro.
    if (itemsWithPrice.length) {
      await PurchaseItemDetail.bulkCreate(
        itemsWithPrice.map((i) => {
          const qty = Number(i.quantity) || 0;
          const linePrice = Number(i.price);
          const unitPrice = qty > 0 ? Math.round((linePrice / qty) * 10000) / 10000 : linePrice;
          return {
            purchaseHistoryId: purchase.id,
            foodId: i.foodId ?? null,
            name: i.name,
            quantity: i.quantity,
            unit: i.unit,
            unitPrice,
            subtotal: Math.round(linePrice * 100) / 100,
          };
        }),
        { transaction: t },
      );
    }

    return purchase.id;
  });

  return getPurchase(actor, purchaseId);
}

// --- Histórico e comparador --------------------------------------------

async function history(actor, { patientProfileId, limit = 30, offset = 0 } = {}) {
  const scope = await resolveScopeProfileIds(actor, patientProfileId);
  const where = {};
  if (scope !== null) {
    if (!scope.length) return { items: [], total: 0 };
    where.patientProfileId = { [Op.in]: scope };
  }
  const { rows, count } = await PurchaseHistory.findAndCountAll({
    where,
    include: [{ model: Market, as: 'market' }],
    order: [['purchasedAt', 'DESC']],
    limit: Math.min(Number(limit) || 30, 100),
    offset: Number(offset) || 0,
  });
  return { items: rows, total: count };
}

async function getPurchase(actor, id) {
  const purchase = await PurchaseHistory.findByPk(id, {
    include: [
      { model: PatientProfile, as: 'patient' },
      { model: Market, as: 'market' },
      { model: PurchaseItemDetail, as: 'items' },
    ],
  });
  if (!purchase) throw AppError.notFound('Compra não encontrada.', 'PURCHASE_NOT_FOUND');
  assertProfileAccess(actor, purchase.patient);
  return purchase;
}

// Comparador de preços por mercado para um alimento (escopo do ator).
async function compareFoodPrices(actor, foodId, { patientProfileId } = {}) {
  if (!foodId) throw AppError.badRequest('foodId é obrigatório.', 'MISSING_FIELDS');
  const scope = await resolveScopeProfileIds(actor, patientProfileId);

  const purchaseWhere = {};
  if (scope !== null) {
    if (!scope.length) return [];
    purchaseWhere.patientProfileId = { [Op.in]: scope };
  }

  const details = await PurchaseItemDetail.findAll({
    where: { foodId },
    include: [
      {
        model: PurchaseHistory,
        as: 'purchase',
        where: purchaseWhere,
        include: [{ model: Market, as: 'market' }],
      },
    ],
  });

  // Agrega por mercado.
  const byMarket = new Map();
  for (const d of details) {
    const market = d.purchase.market;
    const key = market ? market.id : 'sem-mercado';
    const price = Number(d.unitPrice);
    const purchasedAt = d.purchase.purchasedAt;
    const entry = byMarket.get(key) || {
      marketId: market ? market.id : null,
      marketName: market ? market.name : 'Sem mercado',
      samples: 0,
      sum: 0,
      min: Infinity,
      max: -Infinity,
      lastPurchasedAt: null,
    };
    entry.samples += 1;
    entry.sum += price;
    entry.min = Math.min(entry.min, price);
    entry.max = Math.max(entry.max, price);
    if (!entry.lastPurchasedAt || purchasedAt > entry.lastPurchasedAt) entry.lastPurchasedAt = purchasedAt;
    byMarket.set(key, entry);
  }

  const round = (n) => Math.round(n * 10000) / 10000;
  return [...byMarket.values()]
    .map((e) => ({
      marketId: e.marketId,
      marketName: e.marketName,
      samples: e.samples,
      avgUnitPrice: round(e.sum / e.samples),
      minUnitPrice: round(e.min),
      maxUnitPrice: round(e.max),
      lastPurchasedAt: e.lastPurchasedAt,
    }))
    .sort((a, b) => a.avgUnitPrice - b.avgUnitPrice); // mais barato primeiro
}

module.exports = {
  startSession,
  getSession,
  checkItem,
  finalize,
  history,
  getPurchase,
  compareFoodPrices,
};
