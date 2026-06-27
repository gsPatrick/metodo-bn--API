// src/features/anamnesis/anamnesis.controller.js — HTTP do prontuário de anamnese.
const catchAsync = require('../../utils/catch-async');
const { ok, created, noContent } = require('../../utils/http-response');
const service = require('./anamnesis.service');
const { renderReport } = require('./anamnesis.report');

// Catálogo do questionário guiado (renderização do formulário no app).
const schema = catchAsync(async (req, res) => {
  return ok(res, service.schema());
});

// Relatório consolidado (JSON).
const report = catchAsync(async (req, res) => {
  const data = await service.buildReport(req.user, req.params.patientProfileId);
  return ok(res, data);
});

// Relatório imprimível (HTML).
const reportHtml = catchAsync(async (req, res) => {
  const data = await service.buildReport(req.user, req.params.patientProfileId);
  res.type('html').send(renderReport(data));
});

// --- Prontuário-mestre ---
const get = catchAsync(async (req, res) => {
  const anamnesis = await service.get(req.user, req.params.patientProfileId);
  return ok(res, anamnesis);
});

const upsert = catchAsync(async (req, res) => {
  const anamnesis = await service.upsert(req.user, req.params.patientProfileId, req.body);
  return ok(res, anamnesis);
});

const goldenRule = catchAsync(async (req, res) => {
  const rule = await service.getGoldenRule(req.params.patientProfileId);
  return ok(res, rule);
});

// --- Antropometria ---
const addAssessment = catchAsync(async (req, res) => {
  const item = await service.addAssessment(req.user, req.params.patientProfileId, req.body);
  return created(res, item);
});

const listAssessments = catchAsync(async (req, res) => {
  const items = await service.listAssessments(req.user, req.params.patientProfileId);
  return ok(res, items);
});

const removeAssessment = catchAsync(async (req, res) => {
  await service.removeAssessment(req.user, req.params.assessmentId);
  return noContent(res);
});

// --- Exames bioquímicos ---
const addExam = catchAsync(async (req, res) => {
  const item = await service.addExam(req.user, req.params.patientProfileId, req.body);
  return created(res, item);
});

const listExams = catchAsync(async (req, res) => {
  const items = await service.listExams(req.user, req.params.patientProfileId);
  return ok(res, items);
});

// --- Evolução ---
const addEvolution = catchAsync(async (req, res) => {
  const item = await service.addEvolution(req.user, req.params.patientProfileId, req.body);
  return created(res, item);
});

const listEvolutions = catchAsync(async (req, res) => {
  const items = await service.listEvolutions(req.user, req.params.patientProfileId);
  return ok(res, items);
});

module.exports = {
  schema,
  report,
  reportHtml,
  get,
  upsert,
  goldenRule,
  addAssessment,
  listAssessments,
  removeAssessment,
  addExam,
  listExams,
  addEvolution,
  listEvolutions,
};
