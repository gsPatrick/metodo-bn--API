// src/features/meal-log/meal-log.controller.js — HTTP do registro de consumo.
const catchAsync = require('../../utils/catch-async');
const { ok, created, noContent } = require('../../utils/http-response');
const service = require('./meal-log.service');

const listDay = catchAsync(async (req, res) => {
  const data = await service.listDay(req.user, req.query.patientProfileId, req.query.date);
  return ok(res, data);
});

const setItem = catchAsync(async (req, res) => {
  const row = await service.setItem(req.user, { ...req.body, mealItemId: req.params.mealItemId });
  return ok(res, row);
});

const clearItem = catchAsync(async (req, res) => {
  await service.clearItem(req.user, req.query.patientProfileId, req.query.date, req.params.mealItemId);
  return noContent(res);
});

const addExtra = catchAsync(async (req, res) => {
  const row = await service.addExtra(req.user, req.body);
  return created(res, row);
});

const removeExtra = catchAsync(async (req, res) => {
  await service.removeExtra(req.user, req.query.patientProfileId, req.params.extraId);
  return noContent(res);
});

module.exports = { listDay, setItem, clearItem, addExtra, removeExtra };
