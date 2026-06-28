// src/features/market/market.controller.js — HTTP de mercados e busca por proximidade.
const catchAsync = require('../../utils/catch-async');
const { ok, created, noContent } = require('../../utils/http-response');
const service = require('./market.service');

// GET /markets/nearby?lat=&lng=&radiusKm=&limit=
const nearby = catchAsync(async (req, res) => {
  const { lat, lng, radiusKm, limit } = req.query;
  const items = await service.searchNearby({ lat, lng, radiusKm, limit });
  return ok(res, items, 200, { count: items.length });
});

// GET /markets/nearest?lat=&lng=  → mercado mais próximo (Google Places)
const nearest = catchAsync(async (req, res) => {
  const market = await service.nearestPlace({ lat: req.query.lat, lng: req.query.lng });
  return ok(res, market);
});

const list = catchAsync(async (req, res) => {
  const items = await service.listAll();
  return ok(res, items);
});

const getById = catchAsync(async (req, res) => {
  const item = await service.getById(req.params.id);
  return ok(res, item);
});

const create = catchAsync(async (req, res) => {
  const item = await service.create(req.user, req.body);
  return created(res, item);
});

const update = catchAsync(async (req, res) => {
  const item = await service.update(req.user, req.params.id, req.body);
  return ok(res, item);
});

const remove = catchAsync(async (req, res) => {
  await service.remove(req.user, req.params.id);
  return noContent(res);
});

module.exports = { nearby, nearest, list, getById, create, update, remove };
