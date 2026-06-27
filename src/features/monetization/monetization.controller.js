// src/features/monetization/monetization.controller.js — HTTP da config liga/desliga.
const catchAsync = require('../../utils/catch-async');
const { ok } = require('../../utils/http-response');
const service = require('./monetization.service');

const getConfig = catchAsync(async (req, res) => {
  const config = await service.getConfig(req.user, req.query.nutritionistId);
  return ok(res, config);
});

const setConfig = catchAsync(async (req, res) => {
  const config = await service.setConfig(req.user, req.body);
  return ok(res, config);
});

// Status de acesso do paciente autenticado (útil para o app decidir o paywall).
const myAccess = catchAsync(async (req, res) => {
  const decision = await service.checkPatientAccess(req.user.id);
  return ok(res, decision);
});

module.exports = { getConfig, setConfig, myAccess };
