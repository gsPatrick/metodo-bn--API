// src/features/anamnesis/anamnesis.service.js — prontuário de anamnese.
// Mantém o prontuário-mestre (upsert por blocos), avaliações antropométricas,
// exames bioquímicos e evolução. Expõe a "regra de ouro" clínica usada nas dietas.
const {
  Anamnesis,
  AnthropometricAssessment,
  BiochemicalExam,
  NutritionalEvolution,
  PatientProfile,
  PatientRestriction,
  User,
  sequelize,
} = require('../../models');
const AppError = require('../../utils/app-error');
const { ROLES } = require('../../config/constants');
const { validateUpsert, validateAssessment } = require('./anamnesis.validation');
const { QUESTIONNAIRE, ANTHROPOMETRY_FIELDS } = require('./anamnesis.questions');
const { applyClinicalRules } = require('../diet-plan/clinical-rules');

// --- Autorização --------------------------------------------------------

async function loadProfile(patientProfileId) {
  const profile = await PatientProfile.findByPk(patientProfileId);
  if (!profile) throw AppError.notFound('Perfil de paciente não encontrado.', 'PROFILE_NOT_FOUND');
  return profile;
}

function assertAccess(actor, profile) {
  if (actor.role === ROLES.ADMIN) return;
  if (actor.role === ROLES.NUTRITIONIST && profile.nutritionistId === actor.id) return;
  if (actor.role === ROLES.PATIENT && profile.userId === actor.id) return;
  throw AppError.forbidden('Sem permissão sobre esta anamnese.', 'ANAMNESIS_FORBIDDEN');
}

function assertCanEdit(actor) {
  if (actor.role !== ROLES.NUTRITIONIST && actor.role !== ROLES.ADMIN) {
    throw AppError.forbidden('Apenas nutricionista/admin editam a anamnese.', 'NOT_NUTRITIONIST');
  }
}

// --- Prontuário-mestre (upsert por blocos) -----------------------------

// Blocos JSONB de objeto: mesclados (shallow) com o existente.
const BLOCK_FIELDS = [
  'generalInfo', 'socioeconomic', 'lifestyle', 'dailyActivity', 'reproduction',
  'familyHistory', 'gastrointestinal', 'intestinalRhythm', 'urinaryRhythm',
  'eatingHabits', 'clinicalConditions', 'physicalExam', 'foodFrequency', 'dietaryRecall',
];
// Arrays: substituídos quando enviados.
const ARRAY_FIELDS = ['allergies', 'intolerances', 'aversions', 'preferences'];
// Escalares/texto: substituídos quando enviados.
const SCALAR_FIELDS = [
  'pathologyPast', 'pathologyCurrent', 'medicationsSupplements', 'waterIntakeMl',
  'diagnosis', 'objectives', 'status',
];

async function get(actor, patientProfileId) {
  const profile = await loadProfile(patientProfileId);
  assertAccess(actor, profile);
  return Anamnesis.findOne({ where: { patientProfileId } });
}

// Sincroniza alergias/intolerâncias/aversões da anamnese com PatientRestriction.
// Substitui apenas as de origem 'anamnesis' (preserva as cadastradas manualmente).
async function syncRestrictions(patientProfileId, anamnesis, transaction) {
  const rows = [];
  (anamnesis.allergies || []).forEach((label) => rows.push({ type: 'allergy', label, source: 'anamnesis' }));
  (anamnesis.intolerances || []).forEach((label) => rows.push({ type: 'intolerance', label, source: 'anamnesis' }));
  (anamnesis.aversions || []).forEach((label) => rows.push({ type: 'preference', label, source: 'anamnesis' }));

  await PatientRestriction.destroy({ where: { patientProfileId, source: 'anamnesis' }, transaction });
  if (rows.length) {
    await PatientRestriction.bulkCreate(
      rows.map((r) => ({ ...r, patientProfileId })),
      { transaction, validate: true },
    );
  }
}

async function upsert(actor, patientProfileId, data) {
  const profile = await loadProfile(patientProfileId);
  assertAccess(actor, profile);
  assertCanEdit(actor);

  // Validação robusta (não pode entrar dado inválido no prontuário).
  const errors = validateUpsert(data);
  if (errors.length) {
    throw new AppError('Falha de validação da anamnese.', 422, 'VALIDATION_ERROR', errors);
  }

  return sequelize.transaction(async (t) => {
    let anamnesis = await Anamnesis.findOne({ where: { patientProfileId }, transaction: t });
    if (!anamnesis) {
      anamnesis = Anamnesis.build({ patientProfileId, nutritionistId: actor.id });
    }
    if (actor.role === ROLES.NUTRITIONIST) anamnesis.nutritionistId = actor.id;

    BLOCK_FIELDS.forEach((f) => {
      if (data[f] !== undefined) anamnesis[f] = { ...(anamnesis[f] || {}), ...(data[f] || {}) };
    });
    ARRAY_FIELDS.forEach((f) => {
      if (data[f] !== undefined) anamnesis[f] = Array.isArray(data[f]) ? data[f] : [];
    });
    SCALAR_FIELDS.forEach((f) => {
      if (data[f] !== undefined) anamnesis[f] = data[f];
    });

    await anamnesis.save({ transaction: t });
    // Regra de ouro: mantém as restrições do paciente em sincronia com a anamnese.
    await syncRestrictions(patientProfileId, anamnesis, t);
    return anamnesis;
  });
}

// --- Avaliações antropométricas ----------------------------------------

// IMC = peso / altura(m)^2 (calculado se não enviado e houver dados).
function computeImc(heightCm, weightKg) {
  const h = Number(heightCm);
  const w = Number(weightKg);
  if (!h || !w) return null;
  const m = h / 100;
  return Math.round((w / (m * m)) * 100) / 100;
}

async function addAssessment(actor, patientProfileId, data) {
  const profile = await loadProfile(patientProfileId);
  assertAccess(actor, profile);
  assertCanEdit(actor);

  const errors = validateAssessment(data);
  if (errors.length) {
    throw new AppError('Falha de validação da avaliação.', 422, 'VALIDATION_ERROR', errors);
  }

  const date = data.date || new Date().toISOString().slice(0, 10);
  const imc = data.imc != null ? data.imc : computeImc(data.heightCm, data.weightCurrentKg);

  return AnthropometricAssessment.create({
    patientProfileId,
    nutritionistId: actor.role === ROLES.NUTRITIONIST ? actor.id : data.nutritionistId ?? null,
    date,
    heightCm: data.heightCm ?? null,
    weightUsualKg: data.weightUsualKg ?? null,
    weightCurrentKg: data.weightCurrentKg ?? null,
    imc,
    bodyFatPercent: data.bodyFatPercent ?? null,
    circumferences: data.circumferences ?? null,
    skinfolds: data.skinfolds ?? null,
    derived: data.derived ?? null,
    notes: data.notes ?? null,
  });
}

async function listAssessments(actor, patientProfileId) {
  const profile = await loadProfile(patientProfileId);
  assertAccess(actor, profile);
  return AnthropometricAssessment.findAll({ where: { patientProfileId }, order: [['date', 'DESC']] });
}

// Avaliação mais recente — base autoritativa de peso/altura para os cálculos.
async function getLatestAssessment(patientProfileId) {
  return AnthropometricAssessment.findOne({
    where: { patientProfileId },
    order: [['date', 'DESC'], ['createdAt', 'DESC']],
  });
}

async function removeAssessment(actor, id) {
  const a = await AnthropometricAssessment.findByPk(id);
  if (!a) throw AppError.notFound('Avaliação não encontrada.', 'ASSESSMENT_NOT_FOUND');
  const profile = await loadProfile(a.patientProfileId);
  assertAccess(actor, profile);
  assertCanEdit(actor);
  await a.destroy();
  return { deleted: true };
}

// --- Exames bioquímicos -------------------------------------------------

async function addExam(actor, patientProfileId, data) {
  const profile = await loadProfile(patientProfileId);
  assertAccess(actor, profile);
  assertCanEdit(actor);
  return BiochemicalExam.create({
    patientProfileId,
    date: data.date ?? null,
    laboratory: data.laboratory ?? null,
    results: data.results ?? null,
    otherExams: data.otherExams ?? null,
  });
}

async function listExams(actor, patientProfileId) {
  const profile = await loadProfile(patientProfileId);
  assertAccess(actor, profile);
  return BiochemicalExam.findAll({ where: { patientProfileId }, order: [['date', 'DESC']] });
}

// --- Evolução nutricional ----------------------------------------------

async function addEvolution(actor, patientProfileId, data) {
  const profile = await loadProfile(patientProfileId);
  assertAccess(actor, profile);
  assertCanEdit(actor);
  if (!data.notes) throw AppError.badRequest('notes é obrigatório.', 'MISSING_FIELDS');
  return NutritionalEvolution.create({
    patientProfileId,
    nutritionistId: actor.role === ROLES.NUTRITIONIST ? actor.id : null,
    date: data.date || new Date().toISOString().slice(0, 10),
    notes: data.notes,
  });
}

async function listEvolutions(actor, patientProfileId) {
  const profile = await loadProfile(patientProfileId);
  assertAccess(actor, profile);
  return NutritionalEvolution.findAll({ where: { patientProfileId }, order: [['date', 'DESC']] });
}

// --- REGRA DE OURO ------------------------------------------------------
// Consolida as restrições/condições clínicas + antropometria mais recente,
// consumidas pelo módulo de dieta (cálculo e IA).
async function getGoldenRule(patientProfileId) {
  const anamnesis = await Anamnesis.findOne({ where: { patientProfileId } });
  const latest = await getLatestAssessment(patientProfileId);

  return {
    allergies: anamnesis ? anamnesis.allergies || [] : [],
    intolerances: anamnesis ? anamnesis.intolerances || [] : [],
    aversions: anamnesis ? anamnesis.aversions || [] : [],
    preferences: anamnesis ? anamnesis.preferences || [] : [],
    // Condições clínicas atuais (acionam as regras automáticas por patologia).
    clinicalConditions: anamnesis ? anamnesis.clinicalConditions || {} : {},
    pathologies: anamnesis
      ? { family: anamnesis.familyHistory || null, past: anamnesis.pathologyPast || null, current: anamnesis.pathologyCurrent || null }
      : { family: null, past: null, current: null },
    medications: anamnesis ? anamnesis.medicationsSupplements || null : null,
    waterIntakeMl: anamnesis ? anamnesis.waterIntakeMl ?? null : null,
    latestAnthropometry: latest
      ? {
          date: latest.date,
          weightCurrentKg: latest.weightCurrentKg,
          heightCm: latest.heightCm,
          imc: latest.imc,
          bodyFatPercent: latest.bodyFatPercent,
        }
      : null,
  };
}

// Catálogo do questionário guiado (a nutricionista vai perguntando item a item).
function schema() {
  return { sections: QUESTIONNAIRE, anthropometry: ANTHROPOMETRY_FIELDS };
}

// Relatório consolidado do prontuário (visão completa para revisão/impressão).
async function buildReport(actor, patientProfileId) {
  const profile = await PatientProfile.findByPk(patientProfileId, {
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'phone'] }],
  });
  if (!profile) throw AppError.notFound('Perfil de paciente não encontrado.', 'PROFILE_NOT_FOUND');
  assertAccess(actor, profile);

  const [anamnesis, assessments, exams, evolutions, golden] = await Promise.all([
    Anamnesis.findOne({ where: { patientProfileId } }),
    AnthropometricAssessment.findAll({ where: { patientProfileId }, order: [['date', 'DESC']] }),
    BiochemicalExam.findAll({ where: { patientProfileId }, order: [['date', 'DESC']] }),
    NutritionalEvolution.findAll({ where: { patientProfileId }, order: [['date', 'DESC']] }),
    getGoldenRule(patientProfileId),
  ]);

  // Notas clínicas derivadas (regra de ouro) — base p/ a nutricionista.
  const clinical = applyClinicalRules(
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    golden,
  );

  return {
    patient: {
      id: profile.id,
      name: profile.user ? profile.user.name : null,
      email: profile.user ? profile.user.email : null,
      phone: profile.user ? profile.user.phone : null,
      sex: profile.sex,
      birthDate: profile.birthDate,
      goal: profile.goal,
      activityLevel: profile.activityLevel,
    },
    anamnesis,
    assessments,
    exams,
    evolutions,
    goldenRule: golden,
    clinicalNotes: clinical.clinicalNotes,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  get,
  upsert,
  addAssessment,
  listAssessments,
  getLatestAssessment,
  removeAssessment,
  addExam,
  listExams,
  addEvolution,
  listEvolutions,
  getGoldenRule,
  schema,
  buildReport,
  syncRestrictions,
};
