// src/features/diet-plan/diet-plan.service.js — prescrição, cálculo e IA.
// Cálculo de metas (TDEE/macros), fluxo draft→approved com notificação,
// refeições dinâmicas, aplicação de modelos de refeição e montagem via IA.
const { Op } = require('sequelize');
const {
  DietPlan,
  Meal,
  MealItem,
  MealTemplate,
  MealTemplateItem,
  PatientProfile,
  PatientRestriction,
  Food,
  Recipe,
  sequelize,
} = require('../../models');
const AppError = require('../../utils/app-error');
const { ROLES, DIET_PLAN_STATUS } = require('../../config/constants');
const { computeTargets } = require('./nutrition-calculator');
const { applyClinicalRules } = require('./clinical-rules');
const { computePlanNutrition } = require('./nutrition-summary');
const foodService = require('../food/food.service');
const notificationService = require('../notification/notification.service');
const anamnesisService = require('../anamnesis/anamnesis.service');
const aiClient = require('../../providers/ai/diet-ai-client');
const { parseWebDietText, parseWebDietPdf } = require('../../providers/webdiet/webdiet-parser');

// --- Autorização --------------------------------------------------------

async function loadPatientProfile(id) {
  const profile = await PatientProfile.findByPk(id);
  if (!profile) throw AppError.notFound('Perfil de paciente não encontrado.', 'PROFILE_NOT_FOUND');
  return profile;
}

function assertNutriOwnsPatient(actor, profile) {
  if (actor.role === ROLES.ADMIN) return;
  if (actor.role === ROLES.NUTRITIONIST && profile.nutritionistId === actor.id) return;
  throw AppError.forbidden('Paciente não pertence a esta nutricionista.', 'PATIENT_FORBIDDEN');
}

// REGRA DE OURO: enriquece o perfil com a antropometria MAIS RECENTE da anamnese
// (peso/altura autoritativos) antes de calcular o TDEE. Cai no PatientProfile se
// não houver avaliação registrada.
async function enrichProfileForCalc(profile) {
  const latest = await anamnesisService.getLatestAssessment(profile.id);
  return {
    birthDate: profile.birthDate,
    sex: profile.sex,
    activityLevel: profile.activityLevel,
    goal: profile.goal,
    weightKg: latest && latest.weightCurrentKg != null ? latest.weightCurrentKg : profile.weightKg,
    heightCm: latest && latest.heightCm != null ? latest.heightCm : profile.heightCm,
    _anthropometrySource: latest ? 'anamnesis' : 'profile',
  };
}

// Carrega o plano e valida acesso conforme o papel.
async function loadPlanForActor(actor, id, { includeMeals = true } = {}) {
  const include = includeMeals
    ? [
        { model: Meal, as: 'meals', include: [{ model: MealItem, as: 'items', include: [{ model: Food, as: 'food' }] }] },
        { model: Recipe, as: 'recipes' },
      ]
    : [];
  const plan = await DietPlan.findByPk(id, {
    include: [{ model: PatientProfile, as: 'patient' }, ...include],
    order: includeMeals ? [[{ model: Meal, as: 'meals' }, 'sortOrder', 'ASC']] : undefined,
  });
  if (!plan) throw AppError.notFound('Plano alimentar não encontrado.', 'DIET_PLAN_NOT_FOUND');

  if (actor.role === ROLES.ADMIN) return plan;
  if (actor.role === ROLES.NUTRITIONIST && plan.nutritionistId === actor.id) return plan;
  // Paciente: só o próprio perfil e apenas planos APROVADOS.
  if (
    actor.role === ROLES.PATIENT &&
    plan.patient &&
    plan.patient.userId === actor.id &&
    plan.status === DIET_PLAN_STATUS.APPROVED
  ) {
    return plan;
  }
  throw AppError.forbidden('Sem permissão sobre este plano.', 'DIET_PLAN_FORBIDDEN');
}

// --- Cálculo nutricional -----------------------------------------------

async function computeTargetsForPatient(actor, patientProfileId) {
  const profile = await loadPatientProfile(patientProfileId);
  assertNutriOwnsPatient(actor, profile);
  const enriched = await enrichProfileForCalc(profile);
  const base = computeTargets(enriched);
  // Regra de ouro: aplica ajustes clínicos por patologia sobre as metas.
  const goldenRule = await anamnesisService.getGoldenRule(patientProfileId);
  const adjusted = applyClinicalRules(base, goldenRule);
  return {
    ...base,
    ...adjusted, // kcal/macros ajustados + sodiumMaxMg/fiberMinG/proteinMaxG/clinicalNotes
    anthropometrySource: enriched._anthropometrySource,
    goldenRule,
  };
}

// --- CRUD de planos -----------------------------------------------------

async function listPlans(actor, { patientProfileId, status } = {}) {
  const where = {};
  if (patientProfileId) where.patientProfileId = patientProfileId;
  if (status) where.status = status;

  if (actor.role === ROLES.NUTRITIONIST) where.nutritionistId = actor.id;
  if (actor.role === ROLES.PATIENT) {
    const profile = await PatientProfile.findOne({ where: { userId: actor.id } });
    if (!profile) return [];
    where.patientProfileId = profile.id;
    where.status = DIET_PLAN_STATUS.APPROVED; // paciente só vê aprovados
  }
  return DietPlan.findAll({ where, order: [['createdAt', 'DESC']] });
}

async function getPlan(actor, id) {
  const plan = await loadPlanForActor(actor, id);
  // Totais nutricionais realmente entregues pelo plano + aderência às metas.
  const nutrition = computePlanNutrition(plan.meals || [], {
    targetKcal: plan.targetKcal,
    targetCarbsG: plan.targetCarbsG,
    targetProteinG: plan.targetProteinG,
    targetFatG: plan.targetFatG,
  });
  return { ...plan.toJSON(), nutrition };
}

// Resumo nutricional isolado (totais por refeição/plano + aderência à meta).
async function getPlanSummary(actor, id) {
  const plan = await loadPlanForActor(actor, id);
  return computePlanNutrition(plan.meals || [], {
    targetKcal: plan.targetKcal,
    targetCarbsG: plan.targetCarbsG,
    targetProteinG: plan.targetProteinG,
    targetFatG: plan.targetFatG,
  });
}

// Cria um plano em rascunho. Se metas não vierem, calcula a partir do perfil.
async function createPlan(actor, { patientProfileId, title, description, targets }) {
  if (actor.role !== ROLES.NUTRITIONIST && actor.role !== ROLES.ADMIN) {
    throw AppError.forbidden('Apenas nutricionistas criam planos.', 'NOT_NUTRITIONIST');
  }
  const profile = await loadPatientProfile(patientProfileId);
  assertNutriOwnsPatient(actor, profile);
  if (!title) throw AppError.badRequest('title é obrigatório.', 'MISSING_FIELDS');

  // Metas: usa as informadas ou calcula (TDEE + ajustes clínicos da regra de ouro).
  let t = targets;
  if (!t) {
    const base = computeTargets(await enrichProfileForCalc(profile));
    const golden = await anamnesisService.getGoldenRule(patientProfileId);
    t = applyClinicalRules(base, golden);
  }
  const plan = await DietPlan.create({
    patientProfileId,
    nutritionistId: profile.nutritionistId,
    title,
    description: description ?? null,
    targetKcal: t.kcal,
    targetCarbsG: t.carbsG,
    targetProteinG: t.proteinG,
    targetFatG: t.fatG,
    status: DIET_PLAN_STATUS.DRAFT,
  });
  return loadPlanForActor(actor, plan.id);
}

const PLAN_FIELDS = ['title', 'description', 'targetKcal', 'targetCarbsG', 'targetProteinG', 'targetFatG', 'startDate', 'endDate'];

async function updatePlan(actor, id, data) {
  const plan = await loadPlanForActor(actor, id, { includeMeals: false });
  if (plan.status === DIET_PLAN_STATUS.APPROVED) {
    throw AppError.badRequest('Plano aprovado não pode ser editado.', 'PLAN_APPROVED_IMMUTABLE');
  }
  PLAN_FIELDS.forEach((f) => {
    if (data[f] !== undefined) plan[f] = data[f];
  });
  await plan.save();
  return loadPlanForActor(actor, id);
}

// Aprova e libera ao paciente (notifica via WebSocket/push).
async function approvePlan(actor, id) {
  const plan = await loadPlanForActor(actor, id);
  if (plan.status === DIET_PLAN_STATUS.APPROVED) return plan;

  plan.status = DIET_PLAN_STATUS.APPROVED;
  plan.approvedAt = new Date();
  await plan.save();

  // Notifica o usuário-paciente dono do perfil.
  if (plan.patient && plan.patient.userId) {
    await notificationService
      .notify({
        userId: plan.patient.userId,
        title: 'Dieta liberada',
        message: `Sua nutricionista aprovou o plano "${plan.title}".`,
        type: 'diet_approved',
        metadata: { dietPlanId: plan.id },
      })
      .catch((e) => console.error('[diet-plan] notify approve', e));
  }
  return loadPlanForActor(actor, id);
}

async function removePlan(actor, id) {
  const plan = await loadPlanForActor(actor, id, { includeMeals: false });
  await plan.destroy();
  return { deleted: true };
}

// --- Refeições e itens (montagem manual) --------------------------------

// Garante que o ator pode EDITAR o plano (nutri dona/admin, e não aprovado).
async function loadEditablePlan(actor, planId) {
  const plan = await loadPlanForActor(actor, planId, { includeMeals: false });
  if (actor.role === ROLES.PATIENT) throw AppError.forbidden('Paciente não edita planos.', 'PATIENT_READONLY');
  if (plan.status === DIET_PLAN_STATUS.APPROVED) {
    throw AppError.badRequest('Plano aprovado não pode ser editado.', 'PLAN_APPROVED_IMMUTABLE');
  }
  return plan;
}

async function addMeal(actor, planId, { name, sortOrder, preferredTime, notes }) {
  await loadEditablePlan(actor, planId);
  if (!name) throw AppError.badRequest('name é obrigatório.', 'MISSING_FIELDS');
  return Meal.create({ dietPlanId: planId, name, sortOrder: sortOrder ?? 0, preferredTime: preferredTime ?? null, notes: notes ?? null });
}

async function loadEditableMeal(actor, mealId) {
  const meal = await Meal.findByPk(mealId);
  if (!meal) throw AppError.notFound('Refeição não encontrada.', 'MEAL_NOT_FOUND');
  await loadEditablePlan(actor, meal.dietPlanId);
  return meal;
}

async function updateMeal(actor, mealId, data) {
  const meal = await loadEditableMeal(actor, mealId);
  ['name', 'sortOrder', 'preferredTime', 'notes'].forEach((f) => {
    if (data[f] !== undefined) meal[f] = data[f];
  });
  await meal.save();
  return meal;
}

async function removeMeal(actor, mealId) {
  const meal = await loadEditableMeal(actor, mealId);
  await meal.destroy();
  return { deleted: true };
}

async function addMealItem(actor, mealId, data) {
  const meal = await loadEditableMeal(actor, mealId);
  if (!data.foodId && !data.customFoodName) {
    throw AppError.badRequest('Informe foodId ou customFoodName.', 'MISSING_FIELDS');
  }
  const item = await MealItem.create({
    mealId: meal.id,
    foodId: data.foodId ?? null,
    customFoodName: data.customFoodName ?? null,
    quantity: data.quantity ?? 0,
    unit: data.unit ?? 'g',
    sortOrder: data.sortOrder ?? 0,
    notes: data.notes ?? null,
  });
  if (item.foodId) await foodService.incrementUsage([item.foodId]).catch(() => {});
  return item;
}

async function loadEditableItem(actor, itemId) {
  const item = await MealItem.findByPk(itemId, { include: [{ model: Meal, as: 'meal' }] });
  if (!item) throw AppError.notFound('Item não encontrado.', 'MEAL_ITEM_NOT_FOUND');
  await loadEditablePlan(actor, item.meal.dietPlanId);
  return item;
}

async function updateMealItem(actor, itemId, data) {
  const item = await loadEditableItem(actor, itemId);
  ['foodId', 'customFoodName', 'quantity', 'unit', 'sortOrder', 'notes'].forEach((f) => {
    if (data[f] !== undefined) item[f] = data[f];
  });
  // Não pode ficar sem referência (alimento ou texto livre).
  if (!item.foodId && !item.customFoodName) {
    throw AppError.badRequest('Item requer foodId ou customFoodName.', 'MISSING_FIELDS');
  }
  await item.save();
  if (item.foodId) await foodService.incrementUsage([item.foodId]).catch(() => {});
  return item;
}

async function removeMealItem(actor, itemId) {
  const item = await loadEditableItem(actor, itemId);
  await item.destroy();
  return { deleted: true };
}

// Aplica um modelo de refeição: cria a Meal e seus itens em lote (rápido).
async function addMealFromTemplate(actor, planId, templateId) {
  await loadEditablePlan(actor, planId);
  const template = await MealTemplate.findByPk(templateId, {
    include: [{ model: MealTemplateItem, as: 'items' }],
  });
  if (!template) throw AppError.notFound('Modelo de refeição não encontrado.', 'TEMPLATE_NOT_FOUND');
  if (actor.role !== ROLES.ADMIN && template.nutritionistId !== actor.id) {
    throw AppError.forbidden('Modelo de outra nutricionista.', 'TEMPLATE_FORBIDDEN');
  }

  const result = await sequelize.transaction(async (t) => {
    const meal = await Meal.create(
      { dietPlanId: planId, name: template.name, preferredTime: template.preferredTime, sortOrder: 0 },
      { transaction: t },
    );
    await MealItem.bulkCreate(
      template.items.map((it) => ({
        mealId: meal.id,
        foodId: it.foodId,
        customFoodName: it.customFoodName,
        quantity: it.quantity,
        unit: it.unit,
        sortOrder: it.sortOrder,
      })),
      { transaction: t },
    );
    return meal;
  });

  // Atualiza contadores de uso (template e alimentos) fora da transação crítica.
  await MealTemplate.increment('usageCount', { by: 1, where: { id: templateId } }).catch(() => {});
  await foodService.incrementUsage(template.items.map((i) => i.foodId).filter(Boolean)).catch(() => {});
  return result;
}

// --- Montagem assistida por IA -----------------------------------------

// Casa o nome sugerido pela IA com um alimento do catálogo (match em memória).
function matchFood(aiName, candidates) {
  const tokens = String(aiName || '')
    .toLowerCase()
    .split(/[\s,]+/)
    .filter((tk) => tk.length >= 3);
  let best = null;
  let bestScore = 0;
  for (const food of candidates) {
    const name = food.name.toLowerCase();
    let score = 0;
    for (const tk of tokens) if (name.includes(tk)) score += tk.length;
    if (score > bestScore) {
      bestScore = score;
      best = food;
    }
  }
  return bestScore > 0 ? best : null;
}

/**
 * Gera um rascunho de dieta via IA, mapeia para Meals/MealItems reais do
 * catálogo e persiste como plano `draft` para a nutricionista revisar.
 */
async function generateWithAI(actor, { patientProfileId, instruction }) {
  if (actor.role !== ROLES.NUTRITIONIST && actor.role !== ROLES.ADMIN) {
    throw AppError.forbidden('Apenas nutricionistas usam a IA.', 'NOT_NUTRITIONIST');
  }
  const profile = await loadPatientProfile(patientProfileId);
  assertNutriOwnsPatient(actor, profile);

  // REGRA DE OURO: antropometria recente + restrições/patologias da anamnese.
  const enriched = await enrichProfileForCalc(profile);
  const golden = await anamnesisService.getGoldenRule(patientProfileId);
  const targets = applyClinicalRules(computeTargets(enriched), golden);

  // Restrições combinadas: PatientRestriction + anamnese (alergias/intolerâncias/aversões).
  const patientRestrictions = await PatientRestriction.findAll({ where: { patientProfileId } });
  const restrictions = [
    ...patientRestrictions.map((r) => ({ type: r.type, label: r.label })),
    ...(golden.allergies || []).map((label) => ({ type: 'allergy', label })),
    ...(golden.intolerances || []).map((label) => ({ type: 'intolerance', label })),
    ...(golden.aversions || []).map((label) => ({ type: 'preference', label: `evitar: ${label}` })),
  ];

  // Orientações: regras clínicas automáticas (HAS→sódio, DM→carbo, ...) + patologias.
  const notes = [...(targets.clinicalNotes || [])];
  if (targets.sodiumMaxMg) notes.push(`Sódio máximo ~${targets.sodiumMaxMg} mg/dia.`);
  if (targets.fiberMinG) notes.push(`Fibras mínimas ~${targets.fiberMinG} g/dia.`);
  if (golden.pathologies && golden.pathologies.current) notes.push(`Condição atual: ${golden.pathologies.current}.`);
  if (golden.preferences && golden.preferences.length) notes.push(`Preferências: ${golden.preferences.join(', ')}.`);
  const fullInstruction = [instruction || '', ...notes].filter(Boolean).join(' ');

  // Candidatos do catálogo no escopo da nutricionista (uma query).
  const scope = await foodService.resolveScopeNutritionistId(actor);
  const candidates = await foodService.getCandidatesForAI(scope, 60);

  // Chamada à IA (saída estruturada via tool use).
  const draft = await aiClient.generateDietDraft({
    patient: {
      sex: profile.sex,
      age: targets.age,
      weightKg: enriched.weightKg,
      heightCm: enriched.heightCm,
      activityLevel: profile.activityLevel,
      goal: profile.goal,
    },
    restrictions,
    targets,
    instruction: fullInstruction,
    foodCandidates: candidates,
  });

  const usedFoodIds = [];

  const plan = await sequelize.transaction(async (t) => {
    const created = await DietPlan.create(
      {
        patientProfileId,
        nutritionistId: profile.nutritionistId,
        title: draft.title || 'Plano gerado por IA',
        description: instruction ? `Gerado por IA: ${instruction}` : 'Rascunho gerado por IA.',
        targetKcal: targets.kcal,
        targetCarbsG: targets.carbsG,
        targetProteinG: targets.proteinG,
        targetFatG: targets.fatG,
        status: DIET_PLAN_STATUS.DRAFT,
      },
      { transaction: t },
    );

    const meals = Array.isArray(draft.meals) ? draft.meals : [];
    for (let mi = 0; mi < meals.length; mi += 1) {
      const m = meals[mi];
      const meal = await Meal.create(
        {
          dietPlanId: created.id,
          name: m.name || `Refeição ${mi + 1}`,
          sortOrder: m.sortOrder ?? mi,
          preferredTime: /^\d{2}:\d{2}/.test(m.preferredTime || '') ? m.preferredTime : null,
        },
        { transaction: t },
      );

      const items = Array.isArray(m.items) ? m.items : [];
      const rows = items.map((it, idx) => {
        const matched = matchFood(it.foodName, candidates);
        if (matched) usedFoodIds.push(matched.id);
        return {
          mealId: meal.id,
          foodId: matched ? matched.id : null,
          customFoodName: matched ? null : it.foodName, // fallback texto livre
          quantity: Number(it.quantity) || 0,
          unit: it.unit || 'g',
          sortOrder: idx,
          notes: it.notes || null,
        };
      });
      if (rows.length) await MealItem.bulkCreate(rows, { transaction: t });
    }

    return created;
  });

  await foodService.incrementUsage(usedFoodIds).catch(() => {});
  return loadPlanForActor(actor, plan.id);
}

// --- Importação do WebDiet (PDF) -------------------------------------------

// Extrai gramas/ml + unidade do texto de quantidade do WebDiet.
function parseQtyText(qty) {
  if (!qty) return { quantity: 0, unit: 'g', label: null };
  const paren = /\(\s*([\d.,]+)\s*(g|ml)\s*\)/i.exec(qty); // "(52.5g)"
  if (paren) return { quantity: parseFloat(paren[1].replace(',', '.')) || 0, unit: paren[2].toLowerCase(), label: qty };
  const lead = /^([\d.,]+)\s*(g|ml|kg)\b/i.exec(qty.trim()); // "150g"
  if (lead) return { quantity: parseFloat(lead[1].replace(',', '.')) || 0, unit: lead[2].toLowerCase(), label: qty };
  return { quantity: 0, unit: 'g', label: qty };
}

/**
 * Importa um plano alimentar completo a partir do PDF (ou texto) do WebDiet:
 * refeições, alimentos, substituições, macros por refeição/total e receitas.
 * Cria o plano como DRAFT para a nutricionista revisar e aprovar.
 */
async function importFromWebDiet(actor, { patientProfileId, pdfBase64, rawText, title }) {
  const profile = await loadPatientProfile(patientProfileId);
  if (actor.role !== ROLES.ADMIN && !(actor.role === ROLES.NUTRITIONIST && profile.nutritionistId === actor.id)) {
    throw AppError.forbidden('Sem permissão para importar plano deste paciente.', 'PLAN_FORBIDDEN');
  }

  let parsed;
  if (pdfBase64) {
    const buf = Buffer.from(String(pdfBase64).replace(/^data:.*;base64,/, ''), 'base64');
    if (!buf.length) throw AppError.badRequest('PDF inválido.', 'INVALID_PDF');
    parsed = parseWebDietPdf(buf);
  } else if (rawText) {
    parsed = parseWebDietText(String(rawText));
  } else {
    throw AppError.badRequest('Envie pdfBase64 ou rawText.', 'MISSING_PDF');
  }
  if (!parsed.meals || !parsed.meals.length) {
    throw AppError.badRequest('Não foi possível extrair refeições do PDF do WebDiet.', 'PARSE_EMPTY');
  }

  const totals = parsed.totals || {};
  const plan = await sequelize.transaction(async (t) => {
    const created = await DietPlan.create(
      {
        patientProfileId,
        nutritionistId: profile.nutritionistId,
        title: title || `Plano alimentar (WebDiet${parsed.prescritoEm ? ` · ${parsed.prescritoEm}` : ''})`,
        description: 'Importado do WebDiet.',
        targetKcal: totals.kcal ?? null,
        targetCarbsG: totals.carbsG ?? null,
        targetProteinG: totals.proteinG ?? null,
        targetFatG: totals.fatG ?? null,
        status: DIET_PLAN_STATUS.DRAFT,
      },
      { transaction: t },
    );

    for (let mi = 0; mi < parsed.meals.length; mi += 1) {
      const m = parsed.meals[mi];
      const macros = m.macros || {};
      const meal = await Meal.create(
        {
          dietPlanId: created.id,
          name: m.name || `Refeição ${mi + 1}`,
          sortOrder: mi,
          preferredTime: /^\d{1,2}:\d{2}/.test(m.time || '') ? m.time : null,
          kcal: macros.kcal ?? null,
          carbsG: macros.carbsG ?? null,
          proteinG: macros.proteinG ?? null,
          fatG: macros.fatG ?? null,
        },
        { transaction: t },
      );
      const rows = (m.foods || []).map((f, idx) => {
        const q = parseQtyText(f.qty);
        return {
          mealId: meal.id,
          foodId: null,
          customFoodName: f.name,
          quantity: q.quantity,
          unit: q.unit,
          quantityLabel: q.label,
          substitutions: f.subs && f.subs.length ? f.subs : null,
          sortOrder: idx,
        };
      });
      if (rows.length) await MealItem.bulkCreate(rows, { transaction: t });
    }

    const recipes = (parsed.recipes || []).map((r, idx) => ({
      dietPlanId: created.id,
      name: r.name,
      yield: r.yield || null,
      ingredients: r.ingredients || null,
      steps: r.steps || null,
      sortOrder: idx,
    }));
    if (recipes.length) await Recipe.bulkCreate(recipes, { transaction: t });

    return created;
  });

  const full = await DietPlan.findByPk(plan.id, {
    include: [
      { model: Meal, as: 'meals', include: [{ model: MealItem, as: 'items' }] },
      { model: Recipe, as: 'recipes' },
    ],
    order: [[{ model: Meal, as: 'meals' }, 'sortOrder', 'ASC']],
  });
  return {
    plan: full,
    shopping: parsed.shopping || [],
    summary: { meals: parsed.meals.length, recipes: (parsed.recipes || []).length, totals },
  };
}

module.exports = {
  computeTargetsForPatient,
  listPlans,
  getPlan,
  getPlanSummary,
  createPlan,
  updatePlan,
  approvePlan,
  removePlan,
  addMeal,
  updateMeal,
  removeMeal,
  addMealItem,
  updateMealItem,
  removeMealItem,
  addMealFromTemplate,
  generateWithAI,
  importFromWebDiet,
};
