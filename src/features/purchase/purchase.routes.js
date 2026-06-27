// src/features/purchase/purchase.routes.js — rotas do Modo Compra e histórico.
// Acesso por ownership (paciente dono / nutri responsável / admin), validado no service.
const { Router } = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const controller = require('./purchase.controller');

const router = Router();

router.use(authenticate);

// --- Modo Compra (sessão em tempo real) ---
router.post('/sessions', controller.start); // body: { shoppingListId, budget?, marketId? }
router.get('/sessions/:shoppingListId', controller.session);
router.patch('/sessions/items/:itemId/check', controller.checkItem); // body: { isChecked?, price? }
router.post('/finalize', controller.finalize); // body: { shoppingListId, marketId?, notes? }

// --- Histórico e comparador de preços ---
router.get('/history', controller.history); // ?patientProfileId=&limit=&offset=
router.get('/compare/:foodId', controller.compare); // ?patientProfileId=
router.get('/:id', controller.getById);

module.exports = router;
