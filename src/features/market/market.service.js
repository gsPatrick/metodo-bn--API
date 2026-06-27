// src/features/market/market.service.js — cadastro e busca geolocalizada de mercados.
// A proximidade é calculada por Haversine direto em SQL (PostgreSQL) para ordenar
// do mais próximo ao mais distante de forma eficiente, com filtro opcional por raio.
const { QueryTypes } = require('sequelize');
const { Market, sequelize } = require('../../models');
const AppError = require('../../utils/app-error');
const { ROLES } = require('../../config/constants');
const { buildDeepLinks } = require('./market.helper');

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

module.exports = { searchNearby, listAll, getById, create, update, remove };
