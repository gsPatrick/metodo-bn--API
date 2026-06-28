// src/bootstrap/ensure-food-catalog.js
// Popula o catálogo global de alimentos a partir das tabelas oficiais
// (TACO — UNICAMP, e depois TBCA — USP) na primeira subida. Idempotente:
// só semeia uma fonte se ainda não houver nenhum alimento dela.
const { Food } = require('../models');

const SOURCES = [
  { source: 'TACO', file: '../data/foods-taco.json' },
  { source: 'TBCA', file: '../data/foods-tbca.json' },
];

async function seedSource({ source, file }) {
  const existing = await Food.count({ where: { source } });
  if (existing > 0) return { source, skipped: true, existing };

  let foods;
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    foods = require(file);
  } catch {
    return { source, missing: true }; // arquivo ainda não disponível
  }
  if (!Array.isArray(foods) || !foods.length) return { source, empty: true };

  const rows = foods
    .filter((f) => f && f.name)
    .map((f) => ({
      name: String(f.name).slice(0, 180),
      source,
      category: f.category ? String(f.category).slice(0, 80) : null,
      kcal: f.kcal,
      carbsG: f.carbsG,
      proteinG: f.proteinG,
      fatG: f.fatG,
      fiberG: f.fiberG,
      sodiumMg: f.sodiumMg,
      isCustom: false,
      isActive: true,
      usageCount: 0,
    }));

  // insere em lotes para não estourar memória/limites do driver
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    // eslint-disable-next-line no-await-in-loop
    await Food.bulkCreate(rows.slice(i, i + BATCH), { ignoreDuplicates: true });
  }
  return { source, seeded: rows.length };
}

async function ensureFoodCatalog() {
  for (const src of SOURCES) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const r = await seedSource(src);
      if (r.seeded) console.log(`[seed] catálogo ${r.source}: ${r.seeded} alimentos inseridos.`);
      else if (r.skipped) console.log(`[seed] catálogo ${r.source}: já populado (${r.existing}).`);
    } catch (e) {
      console.error(`[seed] catálogo ${src.source} falhou:`, e.message);
    }
  }
}

module.exports = { ensureFoodCatalog };
