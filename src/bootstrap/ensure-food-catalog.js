// src/bootstrap/ensure-food-catalog.js
// Popula o catálogo global de alimentos (TACO — UNICAMP, e TBCA — USP) com
// medidas caseiras oficiais (POF/IBGE). Idempotente: semeia uma fonte se ainda
// não houver alimentos dela; se já houver mas sem medidas, faz backfill.
const Sequelize = require('sequelize');
const { Food } = require('../models');

const SOURCES = [
  { source: 'TACO', file: '../data/foods-taco.json' },
  { source: 'TBCA', file: '../data/foods-tbca.json' },
];

function loadFile(file) {
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    return require(file);
  } catch {
    return null;
  }
}

const n0 = (v) => (v == null || Number.isNaN(Number(v)) ? 0 : Number(v)); // colunas NOT NULL (default 0)
function rowFrom(f, source) {
  return {
    name: String(f.name).slice(0, 180),
    source,
    category: f.category ? String(f.category).slice(0, 80) : null,
    kcal: n0(f.kcal),
    carbsG: n0(f.carbsG),
    proteinG: n0(f.proteinG),
    fatG: n0(f.fatG),
    fiberG: n0(f.fiberG),
    sodiumMg: n0(f.sodiumMg),
    householdMeasures: Array.isArray(f.measures) ? f.measures : [],
    isCustom: false,
    isActive: true,
    usageCount: 0,
  };
}

async function seedFresh({ source, file }) {
  const foods = loadFile(file);
  if (!Array.isArray(foods) || !foods.length) return { source, missing: true };
  const rows = foods.filter((f) => f && f.name).map((f) => rowFrom(f, source));
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    // eslint-disable-next-line no-await-in-loop
    await Food.bulkCreate(rows.slice(i, i + BATCH), { ignoreDuplicates: true });
  }
  return { source, seeded: rows.length };
}

// Atualiza householdMeasures dos alimentos já existentes (match exato por nome).
async function backfillMeasures({ source, file }) {
  // Se já houver algum alimento da fonte com medidas, considera feito (não re-roda).
  const already = await Food.count({
    where: Sequelize.literal(`source = '${source}' AND jsonb_array_length("household_measures") > 0`),
  });
  if (already > 0) return { source, ok: true };
  const foods = loadFile(file);
  if (!Array.isArray(foods)) return { source, missing: true };
  const map = new Map();
  foods.forEach((f) => {
    if (f && f.name && Array.isArray(f.measures) && f.measures.length) map.set(String(f.name).slice(0, 180), f.measures);
  });
  if (!map.size) return { source, ok: true };

  const rows = await Food.findAll({ where: { source }, attributes: ['id', 'name', 'householdMeasures'] });
  const pending = rows.filter((r) => map.has(r.name) && (!r.householdMeasures || r.householdMeasures.length === 0));
  let updated = 0;
  const BATCH = 100;
  for (let i = 0; i < pending.length; i += BATCH) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(
      pending.slice(i, i + BATCH).map((r) => Food.update({ householdMeasures: map.get(r.name) }, { where: { id: r.id } }).then(() => { updated += 1; }))
    );
  }
  return { source, backfilled: updated };
}

async function ensureFoodCatalog() {
  for (const src of SOURCES) {
    try {
      const count = await Food.count({ where: { source: src.source } });
      // eslint-disable-next-line no-await-in-loop
      const r = count === 0 ? await seedFresh(src) : await backfillMeasures(src);
      if (r.seeded) console.log(`[seed] catálogo ${src.source}: ${r.seeded} alimentos inseridos.`);
      else if (r.backfilled) console.log(`[seed] catálogo ${src.source}: ${r.backfilled} medidas caseiras preenchidas.`);
    } catch (e) {
      console.error(`[seed] catálogo ${src.source} falhou:`, e.message);
    }
  }
}

module.exports = { ensureFoodCatalog };
