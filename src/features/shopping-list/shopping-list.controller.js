// src/features/shopping-list/shopping-list.controller.js — HTTP de listas de compras.
const catchAsync = require('../../utils/catch-async');
const { ok, created, noContent } = require('../../utils/http-response');
const service = require('./shopping-list.service');

const generate = catchAsync(async (req, res) => {
  const list = await service.generateFromActivePlan(req.user, req.body);
  return created(res, list);
});

const list = catchAsync(async (req, res) => {
  const items = await service.list(req.user, {
    patientProfileId: req.query.patientProfileId,
    status: req.query.status,
  });
  return ok(res, items);
});

const getById = catchAsync(async (req, res) => {
  const item = await service.getById(req.user, req.params.id);
  return ok(res, item);
});

const setStatus = catchAsync(async (req, res) => {
  const item = await service.setStatus(req.user, req.params.id, req.body.status);
  return ok(res, item);
});

const addItem = catchAsync(async (req, res) => {
  const item = await service.addItem(req.user, req.params.id, req.body);
  return created(res, item);
});

const updateItem = catchAsync(async (req, res) => {
  const item = await service.updateItem(req.user, req.params.itemId, req.body);
  return ok(res, item);
});

const toggleItem = catchAsync(async (req, res) => {
  const item = await service.toggleItem(req.user, req.params.itemId, req.body.isChecked);
  return ok(res, item);
});

const removeItem = catchAsync(async (req, res) => {
  await service.removeItem(req.user, req.params.itemId);
  return noContent(res);
});

module.exports = { generate, list, getById, setStatus, addItem, updateItem, toggleItem, removeItem };
