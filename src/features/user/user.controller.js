// src/features/user/user.controller.js — camada HTTP da feature user.
// Apenas parsing/validação superficial e formatação; regra fica no service.
const catchAsync = require('../../utils/catch-async');
const { ok, created, noContent } = require('../../utils/http-response');
const userService = require('./user.service');

// --- Usuários ---
const list = catchAsync(async (req, res) => {
  const { role, isActive } = req.query;
  const users = await userService.listUsers(req.user, {
    role,
    isActive: isActive === undefined ? undefined : isActive === 'true',
  });
  return ok(res, users);
});

const listMyPatients = catchAsync(async (req, res) => {
  return ok(res, await userService.listMyPatients(req.user));
});

const getById = catchAsync(async (req, res) => {
  const user = await userService.getUserById(req.user, req.params.id);
  return ok(res, user);
});

const create = catchAsync(async (req, res) => {
  const user = await userService.createUser(req.user, req.body);
  return created(res, user);
});

const update = catchAsync(async (req, res) => {
  const user = await userService.updateUser(req.user, req.params.id, req.body);
  return ok(res, user);
});

const setActive = catchAsync(async (req, res) => {
  const user = await userService.setActive(req.user, req.params.id, req.body.isActive);
  return ok(res, user);
});

const updateRole = catchAsync(async (req, res) => {
  const user = await userService.updateRole(req.user, req.params.id, req.body.role);
  return ok(res, user);
});

// --- Provisionamento de paciente ---
const provisionPatient = catchAsync(async (req, res) => {
  const result = await userService.provisionPatient(req.user, req.body);
  return created(res, result);
});

// --- PatientProfile ---
const getMyProfile = catchAsync(async (req, res) => {
  const profile = await userService.getMyProfile(req.user);
  return ok(res, profile);
});

const getProfile = catchAsync(async (req, res) => {
  const profile = await userService.getProfile(req.user, req.params.profileId);
  return ok(res, profile);
});

const updateProfile = catchAsync(async (req, res) => {
  const profile = await userService.updateProfile(req.user, req.params.profileId, req.body);
  return ok(res, profile);
});

// --- PatientRestriction ---
const listRestrictions = catchAsync(async (req, res) => {
  const items = await userService.listRestrictions(req.user, req.params.profileId);
  return ok(res, items);
});

const addRestriction = catchAsync(async (req, res) => {
  const item = await userService.addRestriction(req.user, req.params.profileId, req.body);
  return created(res, item);
});

const updateRestriction = catchAsync(async (req, res) => {
  const item = await userService.updateRestriction(req.user, req.params.restrictionId, req.body);
  return ok(res, item);
});

const removeRestriction = catchAsync(async (req, res) => {
  await userService.removeRestriction(req.user, req.params.restrictionId);
  return noContent(res);
});

module.exports = {
  list,
  listMyPatients,
  getById,
  create,
  update,
  setActive,
  updateRole,
  provisionPatient,
  getMyProfile,
  getProfile,
  updateProfile,
  listRestrictions,
  addRestriction,
  updateRestriction,
  removeRestriction,
};
