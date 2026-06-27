// src/features/billing/billing.controller.js — HTTP de planos, assinaturas e webhook.
const catchAsync = require('../../utils/catch-async');
const { ok, created, noContent } = require('../../utils/http-response');
const service = require('./billing.service');

// --- Planos ---
const createPlan = catchAsync(async (req, res) => {
  const plan = await service.createPlan(req.user, req.body);
  return created(res, plan);
});

const listPlans = catchAsync(async (req, res) => {
  const plans = await service.listPlans(req.user, { nutritionistId: req.query.nutritionistId });
  return ok(res, plans);
});

const updatePlan = catchAsync(async (req, res) => {
  const plan = await service.updatePlan(req.user, req.params.id, req.body);
  return ok(res, plan);
});

const removePlan = catchAsync(async (req, res) => {
  await service.removePlan(req.user, req.params.id);
  return noContent(res);
});

// --- Assinaturas ---
const subscribe = catchAsync(async (req, res) => {
  const result = await service.subscribe(req.user, req.body);
  return created(res, result);
});

const listSubscriptions = catchAsync(async (req, res) => {
  const subs = await service.listSubscriptions(req.user, {
    patientProfileId: req.query.patientProfileId,
    status: req.query.status,
  });
  return ok(res, subs);
});

const getSubscription = catchAsync(async (req, res) => {
  const sub = await service.getSubscription(req.user, req.params.id);
  return ok(res, sub);
});

const cancelSubscription = catchAsync(async (req, res) => {
  const sub = await service.cancelSubscription(req.user, req.params.id);
  return ok(res, sub);
});

// --- Webhook (público) ---
const webhook = catchAsync(async (req, res) => {
  const result = await service.handleWebhook(req.body, req.headers);
  return ok(res, result);
});

module.exports = {
  createPlan,
  listPlans,
  updatePlan,
  removePlan,
  subscribe,
  listSubscriptions,
  getSubscription,
  cancelSubscription,
  webhook,
};
