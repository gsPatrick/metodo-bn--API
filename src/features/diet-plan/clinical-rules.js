// src/features/diet-plan/clinical-rules.js — regras automáticas por patologia.
// Função pura: recebe as metas-base + a "regra de ouro" da anamnese e devolve metas
// ajustadas + limites adicionais (sódio/fibra) + notas clínicas para a IA/nutricionista.
// Reaproveita as condições CLÍNICAS estruturadas (clinicalConditions) e o IMC recente.

const round = (n) => Math.round(n);

/**
 * @param {{kcal,proteinG,carbsG,fatG,age?,bmr?,tdee?,goal?,activityLevel?}} base
 * @param {object} golden  saída de anamnesisService.getGoldenRule
 * @returns metas ajustadas + { sodiumMaxMg, fiberMinG, proteinMaxG, clinicalNotes[] }
 */
function applyClinicalRules(base, golden = {}) {
  let { kcal, proteinG, carbsG, fatG } = base;
  kcal = Number(kcal) || 0;
  proteinG = Number(proteinG) || 0;
  carbsG = Number(carbsG) || 0;
  fatG = Number(fatG) || 0;

  const c = (golden && golden.clinicalConditions) || {};
  const imc =
    golden && golden.latestAnthropometry && golden.latestAnthropometry.imc != null
      ? Number(golden.latestAnthropometry.imc)
      : null;

  const notes = [];
  let sodiumMaxMg = null;
  let fiberMinG = null;
  let proteinMaxG = null;

  // Diabetes: limita carboidrato a ~45% das calorias e realoca o excedente.
  if (c.diabetes) {
    const maxCarb = round((kcal * 0.45) / 4);
    if (carbsG > maxCarb) {
      const removedKcal = (carbsG - maxCarb) * 4;
      carbsG = maxCarb;
      proteinG = round(proteinG + (removedKcal * 0.5) / 4);
      fatG = round(fatG + (removedKcal * 0.5) / 9);
    }
    fiberMinG = Math.max(fiberMinG || 0, 25);
    notes.push('Diabetes: carboidratos limitados a ~45% das calorias; priorizar baixo índice glicêmico e fibras.');
  }

  // Hipertensão: teto de sódio (padrão DASH).
  if (c.hypertension) {
    sodiumMaxMg = 2000;
    notes.push('Hipertensão: limitar sódio a ~2000 mg/dia (padrão DASH); evitar embutidos e ultraprocessados.');
  }

  // Dislipidemia: orientação sobre gorduras.
  if (c.dyslipidemia) {
    notes.push('Dislipidemia: reduzir gordura saturada/trans, priorizar insaturadas e fibras solúveis (aveia, leguminosas).');
  }

  // Doença renal: avaliar proteína (teto conservador ~0,8 g/kg se houver peso).
  if (c.renalDisease) {
    const weight =
      golden && golden.latestAnthropometry && golden.latestAnthropometry.weightCurrentKg != null
        ? Number(golden.latestAnthropometry.weightCurrentKg)
        : null;
    if (weight) {
      proteinMaxG = round(0.8 * weight);
      if (proteinG > proteinMaxG) proteinG = proteinMaxG;
    }
    notes.push('Doença renal: atenção à proteína (alvo conservador ~0,8 g/kg); acompanhamento clínico necessário.');
  }

  // Obesidade (condição declarada ou IMC ≥ 30): reforço de déficit/saciedade.
  if (c.obesity || (imc != null && imc >= 30)) {
    notes.push('Obesidade/IMC elevado: manter déficit calórico e priorizar saciedade (proteína + fibras + vegetais).');
    fiberMinG = Math.max(fiberMinG || 0, 25);
  }

  // Hipotireoidismo: nota de cautela (sem ajuste de macro automático).
  if (c.hypothyroidism) {
    notes.push('Hipotireoidismo: ajustar gasto energético conforme controle; atenção a iodo/selênio.');
  }

  return {
    ...base, // preserva age/bmr/tdee/goal/activityLevel
    kcal: round(kcal),
    proteinG: round(proteinG),
    carbsG: round(carbsG),
    fatG: round(fatG),
    sodiumMaxMg,
    fiberMinG,
    proteinMaxG,
    clinicalNotes: notes,
  };
}

module.exports = { applyClinicalRules };
