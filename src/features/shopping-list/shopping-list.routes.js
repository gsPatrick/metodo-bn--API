// src/features/shopping-list/shopping-list.routes.js — rotas de listas de compras.
// Acesso por ownership (paciente dono / nutri responsável / admin), validado no service.
const { Router } = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireActiveSubscription } = require('../../middlewares/subscription.middleware');
const controller = require('./shopping-list.controller');

const router = Router();

router.use(authenticate);
// Gate de monetização (só afeta pacientes sem assinatura ativa).
router.use(requireActiveSubscription);

// Geração consolidada a partir do plano aprovado.
router.post('/generate', controller.generate);

// Edição/checklist de itens (rotas específicas antes de /:id).
router.post('/:id/items', controller.addItem);
router.patch('/items/:itemId', controller.updateItem);
router.patch('/items/:itemId/check', controller.toggleItem);
router.delete('/items/:itemId', controller.removeItem);

// Listas.
router.get('/', controller.list); // ?patientProfileId=&status=
router.get('/:id', controller.getById);
router.patch('/:id/status', controller.setStatus);

module.exports = router;
