// src/features/health-metric/health-metric.controller.js — HTTP de hábitos diários.
const catchAsync = require('../../utils/catch-async');
const { ok } = require('../../utils/http-response');
const service = require('./health-metric.service');

// Upsert do dia (cria ou atualiza). Retorna o registro com o score calculado.
const upsert = catchAsync(async (req, res) => {
  const metric = await service.upsertDaily(req.user, req.body);
  return ok(res, metric);
});

const list = catchAsync(async (req, res) => {
  const items = await service.list(req.user, {
    patientProfileId: req.query.patientProfileId,
    from: req.query.from,
    to: req.query.to,
  });
  return ok(res, items);
});

const summary = catchAsync(async (req, res) => {
  const result = await service.summary(req.user, {
    patientProfileId: req.query.patientProfileId,
    from: req.query.from,
    to: req.query.to,
  });
  return ok(res, result);
});

const getByDate = catchAsync(async (req, res) => {
  const metric = await service.getByDate(req.user, req.query.patientProfileId, req.params.date);
  return ok(res, metric);
});

module.exports = { upsert, list, summary, getByDate };
