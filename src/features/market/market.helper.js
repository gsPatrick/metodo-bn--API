// src/features/market/market.helper.js — utilitários de geolocalização e navegação.
// Deep-links de rota (Google Maps / Waze) sem custo de API de mapa, e fórmula de
// Haversine em JS como fallback (a busca principal usa SQL — ver service).

const EARTH_RADIUS_KM = 6371;
const toRad = (deg) => (Number(deg) * Math.PI) / 180;

// Distância linear (km) entre dois pontos pela fórmula de Haversine.
function haversineKm(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

// Deep-links de navegação curva a curva a partir das coordenadas do mercado.
function buildDeepLinks({ latitude, longitude, name }) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const label = encodeURIComponent(name || 'Mercado');
  return {
    googleMaps: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    googleMapsPlace: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    waze: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
    geoUri: `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
  };
}

module.exports = { haversineKm, buildDeepLinks, EARTH_RADIUS_KM };
