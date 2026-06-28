// src/features/market/market.service.js — cadastro e busca geolocalizada de mercados.
// A proximidade é calculada por Haversine direto em SQL (PostgreSQL) para ordenar
// do mais próximo ao mais distante de forma eficiente, com filtro opcional por raio.
const { QueryTypes } = require('sequelize');
const { Market, sequelize } = require('../../models');
const AppError = require('../../utils/app-error');
const { ROLES } = require('../../config/constants');
const { buildDeepLinks } = require('./market.helper');
const env = require('../../config/env');

// Mercado mais próximo via Google Places (New) — Nearby Search, ranqueado por distância.
async function nearestPlace({ lat, lng }) {
  const key = env.GOOGLE_MAPS_API_KEY;
  if (!key) throw AppError.badRequest('GOOGLE_MAPS_API_KEY não configurada.', 'NO_GOOGLE_KEY');
  const latN = Number(lat);
  const lngN = Number(lng);
  if (Number.isNaN(latN) || Number.isNaN(lngN)) {
    throw AppError.badRequest('lat e lng são obrigatórios.', 'INVALID_COORDS');
  }
  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.displayName,places.location,places.formattedAddress,places.primaryType',
    },
    body: JSON.stringify({
      includedTypes: ['supermarket', 'grocery_store', 'convenience_store'],
      maxResultCount: 10,
      rankPreference: 'DISTANCE',
      languageCode: 'pt-BR',
      locationRestriction: { circle: { center: { latitude: latN, longitude: lngN }, radius: 50000 } },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data && data.error && data.error.message) || 'Falha na busca do Google Places.';
    throw new AppError(msg, 502, 'GOOGLE_PLACES_ERROR');
  }
  const places = data.places || [];
  if (!places.length) return null;
  const p = places[0]; // já vem ordenado por distância
  return {
    name: (p.displayName && p.displayName.text) || 'Mercado',
    address: p.formattedAddress || null,
    lat: p.location && p.location.latitude,
    lng: p.location && p.location.longitude,
  };
}

// Anexa os deep-links de navegação ao objeto do mercado.
function withLinks(market) {
  const data = typeof market.toJSON === 'function' ? market.toJSON() : { ...market };
  data.navigation = buildDeepLinks(data);
  return data;
}

// Busca mercados ordenados por proximidade (Haversine em SQL).
// O alias `distance_km` não pode ser usado no WHERE direto, por isso a subquery.
async function searchNearby({ lat, lng, radiusKm, limit = 20 }) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    throw AppError.badRequest('lat e lng são obrigatórios e numéricos.', 'INVALID_COORDS');
  }

  const rows = await sequelize.query(
    `
    SELECT * FROM (
      SELECT
        m.*,
        (6371 * acos(
          LEAST(1, GREATEST(-1,
            cos(radians(:lat)) * cos(radians(m.latitude)) *
            cos(radians(m.longitude) - radians(:lng)) +
            sin(radians(:lat)) * sin(radians(m.latitude))
          ))
        )) AS distance_km
      FROM markets m
      WHERE m.is_active = true
    ) t
    WHERE (:radius IS NULL OR t.distance_km <= :radius)
    ORDER BY t.distance_km ASC
    LIMIT :limit
    `,
    {
      replacements: {
        lat: latitude,
        lng: longitude,
        radius: radiusKm != null ? Number(radiusKm) : null,
        limit: Math.min(Number(limit) || 20, 100),
      },
      type: QueryTypes.SELECT,
    },
  );

  // Normaliza saída (snake_case do raw -> objeto com deep-links).
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    address: r.address,
    city: r.city,
    state: r.state,
    latitude: r.latitude,
    longitude: r.longitude,
    isActive: r.is_active,
    distanceKm: Math.round(Number(r.distance_km) * 1000) / 1000,
    navigation: buildDeepLinks({ latitude: r.latitude, longitude: r.longitude, name: r.name }),
  }));
}

async function listAll() {
  const markets = await Market.findAll({ where: { isActive: true }, order: [['name', 'ASC']] });
  return markets.map(withLinks);
}

async function getById(id) {
  const market = await Market.findByPk(id);
  if (!market) throw AppError.notFound('Mercado não encontrado.', 'MARKET_NOT_FOUND');
  return withLinks(market);
}

// Cadastro de mercado — qualquer usuário autenticado pode registrar (crowdsourced).
async function create(actor, data) {
  const { name, latitude, longitude, address, city, state } = data;
  if (!name || latitude == null || longitude == null) {
    throw AppError.badRequest('name, latitude e longitude são obrigatórios.', 'MISSING_FIELDS');
  }
  const market = await Market.create({
    name,
    latitude,
    longitude,
    address: address ?? null,
    city: city ?? null,
    state: state ?? null,
  });
  return withLinks(market);
}

async function update(actor, id, data) {
  if (actor.role !== ROLES.ADMIN) throw AppError.forbidden('Apenas admin edita mercados.', 'NOT_ADMIN');
  const market = await Market.findByPk(id);
  if (!market) throw AppError.notFound('Mercado não encontrado.', 'MARKET_NOT_FOUND');
  ['name', 'address', 'city', 'state', 'latitude', 'longitude', 'isActive'].forEach((f) => {
    if (data[f] !== undefined) market[f] = data[f];
  });
  await market.save();
  return withLinks(market);
}

async function remove(actor, id) {
  if (actor.role !== ROLES.ADMIN) throw AppError.forbidden('Apenas admin remove mercados.', 'NOT_ADMIN');
  const market = await Market.findByPk(id);
  if (!market) throw AppError.notFound('Mercado não encontrado.', 'MARKET_NOT_FOUND');
  await market.destroy();
  return { deleted: true };
}

module.exports = { searchNearby, nearestPlace, listAll, getById, create, update, remove };
