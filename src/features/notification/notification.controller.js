// src/features/notification/notification.controller.js — HTTP de notificações.
const catchAsync = require('../../utils/catch-async');
const { ok, created, noContent } = require('../../utils/http-response');
const service = require('./notification.service');

const list = catchAsync(async (req, res) => {
  const { unread, limit, offset } = req.query;
  const { items, total } = await service.listForUser(req.user.id, {
    onlyUnread: unread === 'true',
    limit,
    offset,
  });
  return ok(res, items, 200, { total });
});

const unreadCount = catchAsync(async (req, res) => {
  const count = await service.getUnreadCount(req.user.id);
  return ok(res, { count });
});

// Envio manual por admin/nutricionista para um usuário.
const send = catchAsync(async (req, res) => {
  const notification = await service.sendToUser(req.user, req.body);
  return created(res, notification);
});

const markAsRead = catchAsync(async (req, res) => {
  const item = await service.markAsRead(req.user.id, req.params.id);
  return ok(res, item);
});

const markAllRead = catchAsync(async (req, res) => {
  const result = await service.markAllRead(req.user.id);
  return ok(res, result);
});

const remove = catchAsync(async (req, res) => {
  await service.remove(req.user.id, req.params.id);
  return noContent(res);
});

module.exports = { list, unreadCount, send, markAsRead, markAllRead, remove };
