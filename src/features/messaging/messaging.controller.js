// src/features/messaging/messaging.controller.js — HTTP do chat.
const catchAsync = require('../../utils/catch-async');
const { ok, created } = require('../../utils/http-response');
const service = require('./messaging.service');

const list = catchAsync(async (req, res) => {
  return ok(res, await service.listConversations(req.user));
});

const open = catchAsync(async (req, res) => {
  const conv = await service.getOrCreate(req.user, req.body.patientProfileId);
  return created(res, conv);
});

const messages = catchAsync(async (req, res) => {
  const items = await service.listMessages(req.user, req.params.id, { before: req.query.before, limit: req.query.limit });
  return ok(res, items);
});

const send = catchAsync(async (req, res) => {
  const message = await service.sendMessage(req.user, req.params.id, req.body);
  return created(res, message);
});

const read = catchAsync(async (req, res) => {
  return ok(res, await service.markRead(req.user, req.params.id));
});

module.exports = { list, open, messages, send, read };
