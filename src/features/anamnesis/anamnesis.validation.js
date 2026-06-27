// src/features/anamnesis/anamnesis.validation.js — validação dos payloads da anamnese.
// Funções puras (sem banco): retornam lista de erros { field, message }.
// O service converte erros em AppError 422 VALIDATION_ERROR.

const BLOCK_FIELDS = [
  'generalInfo', 'socioeconomic', 'lifestyle', 'dailyActivity', 'reproduction',
  'familyHistory', 'gastrointestinal', 'intestinalRhythm', 'urinaryRhythm',
  'eatingHabits', 'physicalExam', 'foodFrequency', 'dietaryRecall', 'clinicalConditions',
];
const ARRAY_FIELDS = ['allergies', 'intolerances', 'aversions', 'preferences'];
const TEXT_FIELDS = ['pathologyPast', 'pathologyCurrent', 'medicationsSupplements', 'diagnosis', 'objectives'];
const STATUS_VALUES = ['draft', 'completed'];

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Valida o payload de upsert do prontuário-mestre.
function validateUpsert(data = {}) {
  const errors = [];
  if (!isPlainObject(data)) {
    return [{ field: 'body', message: 'Corpo da requisição inválido.' }];
  }

  BLOCK_FIELDS.forEach((f) => {
    if (data[f] !== undefined && data[f] !== null && !isPlainObject(data[f])) {
      errors.push({ field: f, message: `${f} deve ser um objeto.` });
    }
  });

  ARRAY_FIELDS.forEach((f) => {
    if (data[f] === undefined || data[f] === null) return;
    if (!Array.isArray(data[f])) {
      errors.push({ field: f, message: `${f} deve ser uma lista.` });
    } else if (!data[f].every((x) => typeof x === 'string')) {
      errors.push({ field: f, message: `${f} deve conter apenas textos.` });
    }
  });

  TEXT_FIELDS.forEach((f) => {
    if (data[f] !== undefined && data[f] !== null && typeof data[f] !== 'string') {
      errors.push({ field: f, message: `${f} deve ser texto.` });
    }
  });

  if (data.waterIntakeMl !== undefined && data.waterIntakeMl !== null) {
    const v = Number(data.waterIntakeMl);
    if (Number.isNaN(v) || v < 0 || v > 20000) {
      errors.push({ field: 'waterIntakeMl', message: 'waterIntakeMl deve ser um número entre 0 e 20000.' });
    }
  }

  if (data.status !== undefined && !STATUS_VALUES.includes(data.status)) {
    errors.push({ field: 'status', message: `status deve ser um de: ${STATUS_VALUES.join(', ')}.` });
  }

  return errors;
}

// Faixas plausíveis para os campos numéricos da antropometria.
const NUMERIC_RANGES = {
  heightCm: [50, 260],
  weightUsualKg: [1, 500],
  weightCurrentKg: [1, 500],
  imc: [5, 100],
  bodyFatPercent: [0, 75],
};

function validateAssessment(data = {}) {
  const errors = [];
  if (!isPlainObject(data)) return [{ field: 'body', message: 'Corpo da requisição inválido.' }];

  if (data.date !== undefined && data.date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(data.date))) {
    errors.push({ field: 'date', message: 'date deve estar no formato YYYY-MM-DD.' });
  }

  Object.entries(NUMERIC_RANGES).forEach(([field, [min, max]]) => {
    if (data[field] === undefined || data[field] === null) return;
    const v = Number(data[field]);
    if (Number.isNaN(v) || v < min || v > max) {
      errors.push({ field, message: `${field} deve ser um número entre ${min} e ${max}.` });
    }
  });

  ['circumferences', 'skinfolds', 'derived'].forEach((f) => {
    if (data[f] !== undefined && data[f] !== null && !isPlainObject(data[f])) {
      errors.push({ field: f, message: `${f} deve ser um objeto.` });
    }
  });

  // Ao menos um dado mensurável.
  const hasAny = ['heightCm', 'weightCurrentKg', 'weightUsualKg', 'bodyFatPercent', 'circumferences', 'skinfolds', 'derived']
    .some((f) => data[f] !== undefined && data[f] !== null);
  if (!hasAny) errors.push({ field: 'body', message: 'Informe ao menos uma medida.' });

  return errors;
}

module.exports = { validateUpsert, validateAssessment, BLOCK_FIELDS, ARRAY_FIELDS, TEXT_FIELDS, STATUS_VALUES };
