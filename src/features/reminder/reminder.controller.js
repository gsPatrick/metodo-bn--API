// src/features/reminder/reminder.controller.js — HTTP dos lembretes.
const catchAsync = require('../../utils/catch-async');
const { ok, created, noContent } = require('../../utils/http-response');
const service = require('./reminder.service');

const list = catchAsync(async (req, res) => ok(res, await service.list(req.user, req.query.patientProfileId)));
const create = catchAsync(async (req, res) => created(res, await service.create(req.user, req.body)));
const update = catchAsync(async (req, res) => ok(res, await service.update(req.user, req.params.id, req.body)));
const remove = catchAsync(async (req, res) => {
  await service.remove(req.user, req.params.id);
  return noContent(res);
});

module.exports = { list, create, update, remove };
