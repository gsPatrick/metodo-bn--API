// src/utils/memory-cache.js — cache em memória simples com TTL (sem dependências).
// Suficiente para acelerar leituras quentes (ex: alimentos mais usados) sem
// adicionar infraestrutura. Para múltiplas instâncias, trocar por Redis no futuro.
class MemoryCache {
  constructor() {
    this.store = new Map(); // key -> { value, expiresAt }
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== 0 && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  // ttlSeconds = 0 → sem expiração.
  set(key, value, ttlSeconds = 0) {
    const expiresAt = ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : 0;
    this.store.set(key, { value, expiresAt });
    return value;
  }

  del(key) {
    this.store.delete(key);
  }

  // Remove por prefixo (invalidação de grupos de chaves).
  delByPrefix(prefix) {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  clear() {
    this.store.clear();
  }
}

module.exports = MemoryCache;
