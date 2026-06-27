// scripts/seed-foods.js — carga inicial (seed) da base nutricional brasileira
// TACO (Unicamp) + TBCA (USP) a partir de um dataset local (custo zero).
//
// Idempotente: a deduplicação usa a combinação (name, source) como chave lógica.
// Reexecutar não duplica registros — atualiza os macros e pula os inalterados.
//
// Todos os itens entram como base do catálogo:
//   isCustom = false, createdByNutritionistId = null, isActive = true
//
// Uso: node scripts/seed-foods.js   (ou: npm run db:seed-foods)
require('dotenv').config();

const fs = require('fs');
const path = require('path');

const db = require('../src/models');
const { Food, sequelize } = db;

const DATASET_PATH = path.join(__dirname, 'foods-taco-tbca.json');

// Campos de macros usados na comparação de "mudou ou não" (por 100g).
const MACRO_FIELDS = ['category', 'kcal', 'carbsG', 'proteinG', 'fatG', 'fiberG', 'sodiumMg'];

// Normaliza um número para comparação consistente (DECIMAL volta como string do PG).
const num = (v) => Number(v ?? 0);

(async () => {
  let inseridos = 0;
  let atualizados = 0;
  let pulados = 0;

  try {
    // ----------------------------------------------------------- leitura do JSON
    if (!fs.existsSync(DATASET_PATH)) {
      throw new Error(`Dataset não encontrado em: ${DATASET_PATH}`);
    }

    let itens;
    try {
      itens = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf8'));
    } catch (parseErr) {
      throw new Error(`Falha ao parsear o JSON do dataset: ${parseErr.message}`);
    }

    if (!Array.isArray(itens) || itens.length === 0) {
      throw new Error('Dataset vazio ou em formato inválido (esperado um array não vazio).');
    }

    await sequelize.authenticate();

    // -------------------------------------------------- upsert dentro de transação
    await sequelize.transaction(async (transaction) => {
      for (const item of itens) {
        if (!item || !item.name || !item.source) {
          throw new Error(
            `Item inválido no dataset (campos "name" e "source" são obrigatórios): ${JSON.stringify(item)}`,
          );
        }

        const payload = {
          name: item.name,
          source: item.source,
          category: item.category ?? null,
          kcal: num(item.kcal),
          carbsG: num(item.carbsG),
          proteinG: num(item.proteinG),
          fatG: num(item.fatG),
          fiberG: num(item.fiberG),
          sodiumMg: num(item.sodiumMg),
          isCustom: false,
          createdByNutritionistId: null,
          isActive: true,
        };

        // Deduplicação por (name, source).
        const [registro, criado] = await Food.findOrCreate({
          where: { name: payload.name, source: payload.source },
          defaults: payload,
          transaction,
        });

        if (criado) {
          inseridos += 1;
          continue;
        }

        // Já existia: atualiza apenas se algum macro/categoria divergir.
        const mudou = MACRO_FIELDS.some((f) =>
          f === 'category'
            ? (registro.category ?? null) !== (payload.category ?? null)
            : num(registro[f]) !== num(payload[f]),
        );

        if (mudou) {
          await registro.update(payload, { transaction });
          atualizados += 1;
        } else {
          pulados += 1;
        }
      }
    });

    // ------------------------------------------------------------------- resumo
    const total = inseridos + atualizados + pulados;
    console.log('✓ Seed de alimentos TACO/TBCA concluído.');
    console.log(`  Inseridos:   ${inseridos}`);
    console.log(`  Atualizados: ${atualizados}`);
    console.log(`  Pulados:     ${pulados}`);
    console.log(`  Total:       ${total} (itens no dataset: ${itens.length})`);

    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('✗ Seed de alimentos falhou:', err.message);
    try {
      await sequelize.close();
    } catch (_) {
      /* ignora erro de fechamento */
    }
    process.exit(1);
  }
})();
