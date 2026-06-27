// src/features/achievement/achievement.controller.js — HTTP das conquistas.
const catchAsync = require('../../utils/catch-async');
const { ok, created } = require('../../utils/http-response');
const service = require('./achievement.service');

const list = catchAsync(async (req, res) => ok(res, await service.list(req.user, req.query.patientProfileId)));
const unlock = catchAsync(async (req, res) => {
  const result = await service.unlock(req.user, req.body);
  return result.isNew ? created(res, result.achievement) : ok(res, result.achievement);
});

module.exports = { list, unlock };
