// src/features/diet-plan/diet-plan.routes.js — rotas de prescrição, refeições e IA.
// RBAC grosso por papel; ownership fino (nutri↔paciente, draft/approved) no service.
const { Router } = require('express');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { requireActiveSubscription } = require('../../middlewares/subscription.middleware');
const { ROLES } = require('../../config/constants');
const controller = require('./diet-plan.controller');

const router = Router();
const NUTRI = [ROLES.NUTRITIONIST, ROLES.ADMIN];

router.use(authenticate);
// Gate de monetização: pacientes sem assinatura ativa (quando a monetização da
// nutricionista está ligada) são bloqueados. Nutri/admin passam direto.
router.use(requireActiveSubscription);

// --- Cálculo nutricional (preview de metas) ---
router.get('/targets/:patientProfileId', authorize(...NUTRI), controller.targets);

// --- Modelos de refeição (rotas específicas antes de /:id) ---
router.get('/templates', authorize(...NUTRI), controller.listTemplates);
router.post('/templates', authorize(...NUTRI), controller.createTemplate);
router.get('/templates/:templateId', authorize(...NUTRI), controller.getTemplate);
router.delete('/templates/:templateId', authorize(...NUTRI), controller.removeTemplate);

// --- Montagem assistida por IA ---
router.post('/ai', authorize(...NUTRI), controller.generateAI);

// --- Importação do WebDiet (PDF base64 ou texto já extraído) ---
// body: { patientProfileId, pdfBase64? | rawText?, title? }
router.post('/import', authorize(...NUTRI), controller.importWebDiet);

// --- Refeições e itens (por id) ---
router.patch('/meals/:mealId', authorize(...NUTRI), controller.updateMeal);
router.delete('/meals/:mealId', authorize(...NUTRI), controller.removeMeal);
router.post('/meals/:mealId/items', authorize(...NUTRI), controller.addMealItem);
router.patch('/items/:itemId', authorize(...NUTRI), controller.updateMealItem);
router.delete('/items/:itemId', authorize(...NUTRI), controller.removeMealItem);

// --- Planos ---
router.get('/', controller.list); // paciente vê só aprovados (filtrado no service)
router.post('/', authorize(...NUTRI), controller.create);
router.get('/:id', controller.getById);
router.get('/:id/summary', controller.summary); // totais nutricionais + aderência
router.patch('/:id', authorize(...NUTRI), controller.update);
router.delete('/:id', authorize(...NUTRI), controller.remove);
router.post('/:id/approve', authorize(...NUTRI), controller.approve);
router.post('/:id/meals', authorize(...NUTRI), controller.addMeal);
router.post('/:id/meals/from-template', authorize(...NUTRI), controller.addMealFromTemplate);

module.exports = router;
