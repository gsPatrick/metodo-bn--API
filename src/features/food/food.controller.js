// src/features/food/food.controller.js — camada HTTP do catálogo de alimentos.
const catchAsync = require('../../utils/catch-async');
const { ok, created, noContent } = require('../../utils/http-response');
const service = require('./food.service');

const search = catchAsync(async (req, res) => {
  const { q, category, source, limit, offset } = req.query;
  const { items, total } = await service.search(req.user, { q, category, source, limit, offset });
  return ok(res, items, 200, { total });
});

const popular = catchAsync(async (req, res) => {
  const items = await service.getPopular(req.user);
  return ok(res, items);
});

const getById = catchAsync(async (req, res) => {
  const food = await service.getById(req.user, req.params.id);
  return ok(res, food);
});

const create = catchAsync(async (req, res) => {
  const food = await service.createCustom(req.user, req.body);
  return created(res, food);
});

const update = catchAsync(async (req, res) => {
  const food = await service.updateCustom(req.user, req.params.id, req.body);
  return ok(res, food);
});

const remove = catchAsync(async (req, res) => {
  await service.removeCustom(req.user, req.params.id);
  return noContent(res);
});

module.exports = { search, popular, getById, create, update, remove };
