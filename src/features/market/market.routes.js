// src/features/market/market.routes.js — rotas de mercados (cadastro + geobusca).
const { Router } = require('express');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { ROLES } = require('../../config/constants');
const controller = require('./market.controller');

const router = Router();

router.use(authenticate);

// Busca por proximidade (rotas específicas antes de /:id).
router.get('/nearby', controller.nearby);
router.get('/nearest', controller.nearest); // mercado mais próximo via Google Places

// Cadastro (qualquer autenticado pode registrar um mercado).
router.post('/', controller.create);

// Listagem e detalhe.
router.get('/', controller.list);
router.get('/:id', controller.getById);

// Moderação (admin).
router.patch('/:id', authorize(ROLES.ADMIN), controller.update);
router.delete('/:id', authorize(ROLES.ADMIN), controller.remove);

module.exports = router;
