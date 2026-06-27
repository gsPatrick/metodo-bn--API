// src/features/diet-plan/diet-plan.controller.js — HTTP de planos, refeições e IA.
const catchAsync = require('../../utils/catch-async');
const { ok, created, noContent } = require('../../utils/http-response');
const service = require('./diet-plan.service');
const templateService = require('./meal-template.service');

// --- Cálculo / metas ---
const targets = catchAsync(async (req, res) => {
  const result = await service.computeTargetsForPatient(req.user, req.params.patientProfileId);
  return ok(res, result);
});

// --- Planos ---
const list = catchAsync(async (req, res) => {
  const items = await service.listPlans(req.user, {
    patientProfileId: req.query.patientProfileId,
    status: req.query.status,
  });
  return ok(res, items);
});

const getById = catchAsync(async (req, res) => {
  const plan = await service.getPlan(req.user, req.params.id);
  return ok(res, plan);
});

const summary = catchAsync(async (req, res) => {
  const nutrition = await service.getPlanSummary(req.user, req.params.id);
  return ok(res, nutrition);
});

const create = catchAsync(async (req, res) => {
  const plan = await service.createPlan(req.user, req.body);
  return created(res, plan);
});

const update = catchAsync(async (req, res) => {
  const plan = await service.updatePlan(req.user, req.params.id, req.body);
  return ok(res, plan);
});

const approve = catchAsync(async (req, res) => {
  const plan = await service.approvePlan(req.user, req.params.id);
  return ok(res, plan);
});

const remove = catchAsync(async (req, res) => {
  await service.removePlan(req.user, req.params.id);
  return noContent(res);
});

const generateAI = catchAsync(async (req, res) => {
  const plan = await service.generateWithAI(req.user, req.body);
  return created(res, plan);
});

// --- Importação do WebDiet (PDF/texto) ---
const importWebDiet = catchAsync(async (req, res) => {
  const result = await service.importFromWebDiet(req.user, req.body);
  return created(res, result);
});

// --- Refeições e itens ---
const addMeal = catchAsync(async (req, res) => {
  const meal = await service.addMeal(req.user, req.params.id, req.body);
  return created(res, meal);
});

const addMealFromTemplate = catchAsync(async (req, res) => {
  const meal = await service.addMealFromTemplate(req.user, req.params.id, req.body.templateId);
  return created(res, meal);
});

const updateMeal = catchAsync(async (req, res) => {
  const meal = await service.updateMeal(req.user, req.params.mealId, req.body);
  return ok(res, meal);
});

const removeMeal = catchAsync(async (req, res) => {
  await service.removeMeal(req.user, req.params.mealId);
  return noContent(res);
});

const addMealItem = catchAsync(async (req, res) => {
  const item = await service.addMealItem(req.user, req.params.mealId, req.body);
  return created(res, item);
});

const updateMealItem = catchAsync(async (req, res) => {
  const item = await service.updateMealItem(req.user, req.params.itemId, req.body);
  return ok(res, item);
});

const removeMealItem = catchAsync(async (req, res) => {
  await service.removeMealItem(req.user, req.params.itemId);
  return noContent(res);
});

// --- Modelos de refeição (meal templates) ---
const listTemplates = catchAsync(async (req, res) => {
  const items = await templateService.list(req.user);
  return ok(res, items);
});

const getTemplate = catchAsync(async (req, res) => {
  const item = await templateService.getById(req.user, req.params.templateId);
  return ok(res, item);
});

const createTemplate = catchAsync(async (req, res) => {
  const item = await templateService.create(req.user, req.body);
  return created(res, item);
});

const removeTemplate = catchAsync(async (req, res) => {
  await templateService.remove(req.user, req.params.templateId);
  return noContent(res);
});

module.exports = {
  targets,
  list,
  getById,
  summary,
  create,
  update,
  approve,
  remove,
  generateAI,
  importWebDiet,
  addMeal,
  updateMeal,
  addMealFromTemplate,
  removeMeal,
  addMealItem,
  updateMealItem,
  removeMealItem,
  listTemplates,
  getTemplate,
  createTemplate,
  removeTemplate,
};
