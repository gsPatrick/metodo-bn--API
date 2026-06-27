// scripts/nutrition-selfcheck.js — verificação do cálculo de totais do plano (sem banco).
// Garante que os totais por refeição/plano e a aderência à meta estão corretos.
//
// Uso: node scripts/nutrition-selfcheck.js   (ou: npm run selfcheck:nutrition)

const { computePlanNutrition, itemContribution } = require('../src/features/diet-plan/nutrition-summary');

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${name}`);
  }
}

const rice = { kcal: 128, carbsG: 28, proteinG: 2.5, fatG: 0.2, fiberG: 1.6, sodiumMg: 1 };
const chicken = { kcal: 159, carbsG: 0, proteinG: 32, fatG: 2.5, fiberG: 0, sodiumMg: 60 };

const meals = [
  {
    id: 'm1',
    name: 'Almoço',
    items: [
      { quantity: 150, unit: 'g', food: rice }, // 1.5x
      { quantity: 100, unit: 'g', food: chicken }, // 1.0x
      { quantity: 1, unit: 'unidade', food: { kcal: 70, carbsG: 0, proteinG: 6, fatG: 5 } }, // não calculável
      { quantity: 50, unit: 'g', food: null, customFoodName: 'Salada' }, // sem food
    ],
  },
];

// --- Contribuição por item ---
check('item g é proporcional (150g de arroz = 192 kcal)', Math.round(itemContribution({ quantity: 150, unit: 'g', food: rice }).kcal) === 192);
check('item unidade caseira não é calculável', itemContribution({ quantity: 1, unit: 'unidade', food: rice }).computable === false);
check('item sem food não é calculável', itemContribution({ quantity: 50, unit: 'g', food: null }).computable === false);

// --- Plano completo ---
const r = computePlanNutrition(meals, { targetKcal: 700, targetProteinG: 50, targetCarbsG: 80, targetFatG: 20 });

check('total kcal correto (192 + 159 = 351)', r.totals.kcal === 351);
check('total proteína correto (3.75 + 32 = 35.75)', r.totals.proteinG === 35.75);
check('total carbo correto (42)', r.totals.carbsG === 42);
check('total gordura correto (0.3 + 2.5 = 2.8)', r.totals.fatG === 2.8);
check('conta itens não calculáveis (2)', r.uncomputedItems === 2);
check('conta total de itens (4)', r.totalItems === 4);
check('resumo por refeição existe', r.meals.length === 1 && r.meals[0].totals.kcal === 351);

check('aderência kcal: percent', r.adherence.kcal.percent === 50);
check('aderência kcal: diff', r.adherence.kcal.diff === -349);
check('aderência kcal: target/actual', r.adherence.kcal.target === 700 && r.adherence.kcal.actual === 351);

// --- Sem metas e vazio ---
const noTarget = computePlanNutrition(meals);
check('sem metas → adherence null', noTarget.adherence === null);

const empty = computePlanNutrition([], { targetKcal: 2000 });
check('plano vazio → totais zerados', empty.totals.kcal === 0 && empty.totalItems === 0);
check('plano vazio → aderência 0%', empty.adherence.kcal.percent === 0);

console.log(`\nnutrition-selfcheck: ${passed} OK, ${failed} falha(s).`);
process.exit(failed === 0 ? 0 : 1);
