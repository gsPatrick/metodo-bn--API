// src/features/billing/billing.routes.js — rotas de cobrança.
// O webhook é PÚBLICO (validado por token Asaas); o restante exige autenticação.
const { Router } = require('express');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { ROLES } = require('../../config/constants');
const controller = require('./billing.controller');

const router = Router();

// --- Público: webhook do Asaas (antes do authenticate) ---
router.post('/webhook', controller.webhook);

// --- Protegido ---
router.use(authenticate);

// Planos de cobrança (nutricionista/admin) — listagem aberta a pacientes (planos da sua nutri).
router.get('/plans', controller.listPlans);
router.post('/plans', authorize(ROLES.NUTRITIONIST, ROLES.ADMIN), controller.createPlan);
router.patch('/plans/:id', authorize(ROLES.NUTRITIONIST, ROLES.ADMIN), controller.updatePlan);
router.delete('/plans/:id', authorize(ROLES.NUTRITIONIST, ROLES.ADMIN), controller.removePlan);

// Assinaturas.
router.post('/subscriptions', controller.subscribe); // paciente (próprio) ou nutri/admin
router.get('/subscriptions', controller.listSubscriptions);
router.get('/subscriptions/:id', controller.getSubscription);
router.post('/subscriptions/:id/cancel', controller.cancelSubscription);

module.exports = router;
