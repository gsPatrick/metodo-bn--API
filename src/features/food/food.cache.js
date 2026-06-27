// src/features/food/food.cache.js — instância de cache compartilhada da feature food.
// Mantém em memória os alimentos mais usados por escopo (público / por nutricionista),
// reduzindo consultas redundantes ao banco durante a montagem de dietas.
const MemoryCache = require('../../utils/memory-cache');

const cache = new MemoryCache();
const POPULAR_PREFIX = 'popular:';

const popularKey = (scope) => `${POPULAR_PREFIX}${scope}`;

// Invalida todos os rankings de populares (após mudança em usage_count/custom).
function invalidatePopular() {
  cache.delByPrefix(POPULAR_PREFIX);
}

module.exports = { cache, popularKey, invalidatePopular };
