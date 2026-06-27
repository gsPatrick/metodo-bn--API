// src/features/health-metric/health-score.js — cálculo do Lifestyle/Health Score (1-100).
// Cada métrica é normalizada para 0-100 e combinada por pesos configuráveis.
// Métricas ausentes (null) são ignoradas e os pesos são renormalizados, evitando
// que a falta de um dado zere o score do dia.

// Pesos por métrica (configuráveis). Somam 1.0 quando todas presentes.
const WEIGHTS = {
  dietAdherence: 0.28, // maior peso: adesão à dieta
  waterMl: 0.22, // e ingestão de água
  sleepHours: 0.18,
  trainedToday: 0.17, // treinou no dia
  steps: 0.1,
  stressLevel: 0.05,
};

const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, n));

// Sub-scores: cada função mapeia o valor bruto para 0-100.
const SUBSCORES = {
  // Ideal ~8h; penaliza 15 pts por hora de desvio.
  sleepHours: (h) => clamp(100 - Math.abs(Number(h) - 8) * 15),
  // Meta 10.000 passos.
  steps: (s) => clamp((Number(s) / 10000) * 100),
  // Meta 2.500 ml.
  waterMl: (ml) => clamp((Number(ml) / 2500) * 100),
  // Escala 1-10, MENOR é melhor.
  stressLevel: (v) => clamp(((10 - Number(v)) / 9) * 100),
  // Escala 1-10, MAIOR é melhor.
  dietAdherence: (v) => clamp((Number(v) / 10) * 100),
  // Booleano: treinou (100) ou não (0).
  trainedToday: (v) => (v ? 100 : 0),
};

/**
 * Calcula o score do dia (1-100) ou null se não houver nenhuma métrica.
 * @param {object} metrics campos: sleepHours, steps, waterMl, stressLevel, dietAdherence
 * @param {object} [weights] sobrescreve os pesos padrão
 */
function computeScore(metrics, weights = WEIGHTS) {
  const present = Object.keys(SUBSCORES).filter(
    (k) => metrics[k] !== undefined && metrics[k] !== null && metrics[k] !== '',
  );
  if (!present.length) return null;

  // Renormaliza os pesos sobre as métricas presentes.
  const totalWeight = present.reduce((acc, k) => acc + (weights[k] || 0), 0);
  if (totalWeight <= 0) return null;

  const weighted = present.reduce((acc, k) => {
    const sub = SUBSCORES[k](metrics[k]);
    return acc + sub * ((weights[k] || 0) / totalWeight);
  }, 0);

  return clamp(Math.round(weighted), 1, 100);
}

module.exports = { computeScore, WEIGHTS, SUBSCORES };
