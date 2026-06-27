// src/features/diet-plan/nutrition-calculator.js — cálculo de TDEE e divisão de macros.
// Funções puras, testáveis. Baseado em Mifflin-St Jeor (BMR) + fator de atividade.
const { ACTIVITY_LEVELS, GOALS, SEX } = require('../../config/constants');

// Multiplicadores clássicos do fator de atividade física.
const ACTIVITY_FACTORS = {
  [ACTIVITY_LEVELS.SEDENTARY]: 1.2,
  [ACTIVITY_LEVELS.LIGHT]: 1.375,
  [ACTIVITY_LEVELS.MODERATE]: 1.55,
  [ACTIVITY_LEVELS.ACTIVE]: 1.725,
  [ACTIVITY_LEVELS.VERY_ACTIVE]: 1.9,
};

// Ajuste calórico por objetivo (déficit/superávit) e split de macros (%).
const GOAL_CONFIG = {
  [GOALS.LOSE_WEIGHT]: { kcalFactor: 0.8, split: { protein: 0.35, carbs: 0.4, fat: 0.25 } },
  [GOALS.MAINTAIN]: { kcalFactor: 1.0, split: { protein: 0.3, carbs: 0.45, fat: 0.25 } },
  [GOALS.GAIN_MUSCLE]: { kcalFactor: 1.1, split: { protein: 0.3, carbs: 0.5, fat: 0.2 } },
};

// Idade a partir da data de nascimento (anos). Fallback 30 se ausente.
function ageFromBirthDate(birthDate) {
  if (!birthDate) return 30;
  const birth = new Date(birthDate);
  const diffMs = Date.now() - birth.getTime();
  const years = diffMs / (365.25 * 24 * 60 * 60 * 1000);
  return Math.max(10, Math.round(years));
}

// BMR — Mifflin-St Jeor.
function basalMetabolicRate({ sex, weightKg, heightCm, age }) {
  const w = Number(weightKg);
  const h = Number(heightCm);
  const base = 10 * w + 6.25 * h - 5 * age;
  return sex === SEX.MALE ? base + 5 : base - 161; // feminino/other usam -161
}

/**
 * Calcula metas calóricas e de macros a partir do PatientProfile.
 * @returns {{ age, bmr, tdee, kcal, proteinG, carbsG, fatG, goal, activityLevel }}
 */
function computeTargets(profile) {
  const age = ageFromBirthDate(profile.birthDate);
  const sex = profile.sex || SEX.OTHER;
  const weightKg = Number(profile.weightKg) || 70;
  const heightCm = Number(profile.heightCm) || 170;
  const activityLevel = profile.activityLevel || ACTIVITY_LEVELS.SEDENTARY;
  const goal = profile.goal || GOALS.MAINTAIN;

  const bmr = basalMetabolicRate({ sex, weightKg, heightCm, age });
  const factor = ACTIVITY_FACTORS[activityLevel] || ACTIVITY_FACTORS[ACTIVITY_LEVELS.SEDENTARY];
  const tdee = bmr * factor;

  const goalCfg = GOAL_CONFIG[goal] || GOAL_CONFIG[GOALS.MAINTAIN];
  const kcal = tdee * goalCfg.kcalFactor;

  // Macros: 4 kcal/g (proteína e carbo), 9 kcal/g (gordura).
  const proteinG = (kcal * goalCfg.split.protein) / 4;
  const carbsG = (kcal * goalCfg.split.carbs) / 4;
  const fatG = (kcal * goalCfg.split.fat) / 9;

  const round = (n) => Math.round(n);
  return {
    age,
    bmr: round(bmr),
    tdee: round(tdee),
    kcal: round(kcal),
    proteinG: round(proteinG),
    carbsG: round(carbsG),
    fatG: round(fatG),
    goal,
    activityLevel,
  };
}

module.exports = { computeTargets, basalMetabolicRate, ageFromBirthDate, ACTIVITY_FACTORS, GOAL_CONFIG };
