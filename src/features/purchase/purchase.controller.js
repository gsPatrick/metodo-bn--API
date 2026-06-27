// src/features/purchase/purchase.controller.js — HTTP do Modo Compra e histórico.
const catchAsync = require('../../utils/catch-async');
const { ok, created } = require('../../utils/http-response');
const service = require('./purchase.service');

// --- Sessão de compra ---
const start = catchAsync(async (req, res) => {
  const summary = await service.startSession(req.user, req.body);
  return ok(res, summary);
});

const session = catchAsync(async (req, res) => {
  const summary = await service.getSession(req.user, req.params.shoppingListId);
  return ok(res, summary);
});

const checkItem = catchAsync(async (req, res) => {
  const result = await service.checkItem(req.user, req.params.itemId, req.body);
  return ok(res, result);
});

const finalize = catchAsync(async (req, res) => {
  const purchase = await service.finalize(req.user, req.body);
  return created(res, purchase);
});

// --- Histórico e comparador ---
const history = catchAsync(async (req, res) => {
  const { patientProfileId, limit, offset } = req.query;
  const { items, total } = await service.history(req.user, { patientProfileId, limit, offset });
  return ok(res, items, 200, { total });
});

const getById = catchAsync(async (req, res) => {
  const purchase = await service.getPurchase(req.user, req.params.id);
  return ok(res, purchase);
});

const compare = catchAsync(async (req, res) => {
  const rows = await service.compareFoodPrices(req.user, req.params.foodId, {
    patientProfileId: req.query.patientProfileId,
  });
  return ok(res, rows);
});

module.exports = { start, session, checkItem, finalize, history, getById, compare };
