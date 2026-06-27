// scripts/anamnesis-selfcheck.js — verificação de lógica pura da anamnese (sem banco).
// Exercita validação, regras clínicas e o catálogo de perguntas. Garante que o
// coração do módulo (a primeira coisa que a nutricionista usa) não tem erro.
//
// Uso: node scripts/anamnesis-selfcheck.js   (ou: npm run selfcheck:anamnesis)

const { validateUpsert, validateAssessment } = require('../src/features/anamnesis/anamnesis.validation');
const { QUESTIONNAIRE, ANTHROPOMETRY_FIELDS } = require('../src/features/anamnesis/anamnesis.questions');
const { applyClinicalRules } = require('../src/features/diet-plan/clinical-rules');

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) {
    passed += 1;
  } else {
    failed += 1;
    console.error(`  ✗ ${name}`);
  }
}

// --- Validação do upsert ---
check('upsert válido não gera erros', validateUpsert({
  allergies: ['amendoim'],
  intolerances: ['lactose'],
  familyHistory: { has: true },
  clinicalConditions: { diabetes: true },
  waterIntakeMl: 2000,
  status: 'completed',
}).length === 0);

check('upsert rejeita allergies não-lista', validateUpsert({ allergies: 'amendoim' }).some((e) => e.field === 'allergies'));
check('upsert rejeita bloco não-objeto', validateUpsert({ lifestyle: [1, 2] }).some((e) => e.field === 'lifestyle'));
check('upsert rejeita waterIntakeMl fora de faixa', validateUpsert({ waterIntakeMl: 999999 }).some((e) => e.field === 'waterIntakeMl'));
check('upsert rejeita status inválido', validateUpsert({ status: 'x' }).some((e) => e.field === 'status'));
check('upsert rejeita array de não-strings', validateUpsert({ intolerances: [1, 2] }).some((e) => e.field === 'intolerances'));

// --- Validação de antropometria ---
check('assessment válido não gera erros', validateAssessment({ date: '2026-06-25', heightCm: 168, weightCurrentKg: 72 }).length === 0);
check('assessment exige alguma medida', validateAssessment({ date: '2026-06-25' }).some((e) => e.field === 'body'));
check('assessment rejeita altura absurda', validateAssessment({ heightCm: 999 }).some((e) => e.field === 'heightCm'));
check('assessment rejeita data inválida', validateAssessment({ date: '25/06/2026', heightCm: 168 }).some((e) => e.field === 'date'));

// --- Regras clínicas ---
const base = { kcal: 2000, proteinG: 150, carbsG: 250, fatG: 56, age: 30, tdee: 2200, goal: 'maintain' };

const dm = applyClinicalRules(base, { clinicalConditions: { diabetes: true } });
check('diabetes limita carbo a 45% kcal', dm.carbsG === 225);
check('diabetes preserva idade (base)', dm.age === 30);
check('diabetes define fibra mínima', dm.fiberMinG === 25);
check('diabetes adiciona nota clínica', dm.clinicalNotes.some((n) => /Diabetes/i.test(n)));

const has = applyClinicalRules(base, { clinicalConditions: { hypertension: true } });
check('hipertensão define teto de sódio', has.sodiumMaxMg === 2000);

const renal = applyClinicalRules(base, {
  clinicalConditions: { renalDisease: true },
  latestAnthropometry: { weightCurrentKg: 80 },
});
check('doença renal limita proteína (~0,8 g/kg)', renal.proteinMaxG === 64 && renal.proteinG === 64);

const obeseByImc = applyClinicalRules(base, { clinicalConditions: {}, latestAnthropometry: { imc: 32 } });
check('IMC>=30 gera nota de obesidade', obeseByImc.clinicalNotes.some((n) => /Obesidade/i.test(n)));

const none = applyClinicalRules(base, {});
check('sem condições não altera macros', none.carbsG === 250 && none.clinicalNotes.length === 0);

// --- Catálogo de perguntas ---
check('questionário tem seções', Array.isArray(QUESTIONNAIRE) && QUESTIONNAIRE.length >= 10);
check('toda seção tem title e fields', QUESTIONNAIRE.every((s) => s.title && Array.isArray(s.fields) && s.fields.length));
check('todo campo tem key, label e type', QUESTIONNAIRE.every((s) => s.fields.every((f) => f.key && f.label && f.type)));
check('antropometria tem campos', Array.isArray(ANTHROPOMETRY_FIELDS) && ANTHROPOMETRY_FIELDS.length >= 5);

// --- Resultado ---
console.log(`\nanamnesis-selfcheck: ${passed} OK, ${failed} falha(s).`);
process.exit(failed === 0 ? 0 : 1);
