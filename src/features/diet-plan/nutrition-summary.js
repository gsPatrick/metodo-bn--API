// src/features/diet-plan/nutrition-summary.js — totais nutricionais do plano.
// Função pura: soma o que o plano REALMENTE entrega a partir dos MealItem × Food
// (macros por 100g), por refeição e total, e calcula a aderência às metas.
// Unidades g/ml são proporcionais (qty/100); outras unidades (unidade, fatia,
// colher) não têm conversão segura → contam como "não calculados" e são sinalizadas.

const PROPORTIONAL_UNITS = ['g', 'ml', 'grama', 'gramas'];

const round = (n) => Math.round(n * 100) / 100;

// Contribuição de um item (objeto puro: { quantity, unit, food }).
function itemContribution(item) {
  const food = item.food || null;
  const unit = String(item.unit || 'g').toLowerCase();
  const qty = Number(item.quantity) || 0;

  if (!food) return { computable: false, kcal: 0, carbsG: 0, proteinG: 0, fatG: 0, fiberG: 0, sodiumMg: 0 };
  if (!PROPORTIONAL_UNITS.includes(unit)) {
    // Sem conversão segura (ex.: "1 unidade") — não soma, mas não invalida o plano.
    return { computable: false, kcal: 0, carbsG: 0, proteinG: 0, fatG: 0, fiberG: 0, sodiumMg: 0 };
  }
  const f = qty / 100;
  return {
    computable: true,
    kcal: Number(food.kcal) * f,
    carbsG: Number(food.carbsG) * f,
    proteinG: Number(food.proteinG) * f,
    fatG: Number(food.fatG) * f,
    fiberG: Number(food.fiberG || 0) * f,
    sodiumMg: Number(food.sodiumMg || 0) * f,
  };
}

const emptyTotals = () => ({ kcal: 0, carbsG: 0, proteinG: 0, fatG: 0, fiberG: 0, sodiumMg: 0 });

function addInto(acc, c) {
  acc.kcal += c.kcal;
  acc.carbsG += c.carbsG;
  acc.proteinG += c.proteinG;
  acc.fatG += c.fatG;
  acc.fiberG += c.fiberG;
  acc.sodiumMg += c.sodiumMg;
}

function roundTotals(t) {
  return {
    kcal: round(t.kcal),
    carbsG: round(t.carbsG),
    proteinG: round(t.proteinG),
    fatG: round(t.fatG),
    fiberG: round(t.fiberG),
    sodiumMg: round(t.sodiumMg),
  };
}

// Aderência de um valor real à meta (percentual e diferença).
function adherenceLine(actual, target) {
  if (target == null || Number(target) === 0) return null;
  const tgt = Number(target);
  return {
    target: round(tgt),
    actual: round(actual),
    percent: Math.round((actual / tgt) * 100),
    diff: round(actual - tgt),
  };
}

/**
 * @param {Array} meals  refeições com `items` (cada item com `quantity`, `unit`, `food`)
 * @param {object} [targets]  { kcal, carbsG, proteinG, fatG } (ou targetKcal/... do DietPlan)
 */
function computePlanNutrition(meals = [], targets = null) {
  const planTotals = emptyTotals();
  let uncomputedItems = 0;
  let totalItems = 0;

  const mealSummaries = (meals || []).map((meal) => {
    const mealTotals = emptyTotals();
    (meal.items || []).forEach((item) => {
      totalItems += 1;
      const c = itemContribution(item);
      if (!c.computable) uncomputedItems += 1;
      addInto(mealTotals, c);
      addInto(planTotals, c);
    });
    return {
      mealId: meal.id,
      name: meal.name,
      itemCount: (meal.items || []).length,
      totals: roundTotals(mealTotals),
    };
  });

  // Normaliza as metas (aceita kcal/carbsG... ou targetKcal/targetCarbsG...).
  let adherence = null;
  if (targets) {
    const t = {
      kcal: targets.kcal ?? targets.targetKcal,
      carbsG: targets.carbsG ?? targets.targetCarbsG,
      proteinG: targets.proteinG ?? targets.targetProteinG,
      fatG: targets.fatG ?? targets.targetFatG,
    };
    adherence = {
      kcal: adherenceLine(planTotals.kcal, t.kcal),
      carbsG: adherenceLine(planTotals.carbsG, t.carbsG),
      proteinG: adherenceLine(planTotals.proteinG, t.proteinG),
      fatG: adherenceLine(planTotals.fatG, t.fatG),
    };
  }

  return {
    totals: roundTotals(planTotals),
    meals: mealSummaries,
    totalItems,
    uncomputedItems, // itens sem conversão (unidades caseiras) — não somados
    adherence,
  };
}

module.exports = { computePlanNutrition, itemContribution };
