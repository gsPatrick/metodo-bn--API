// src/features/food/food.routes.js — rotas do catálogo de alimentos.
const { Router } = require('express');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { ROLES } = require('../../config/constants');
const controller = require('./food.controller');

const router = Router();

router.use(authenticate);

// Leitura (visibilidade aplicada no service): qualquer autenticado.
router.get('/', controller.search); // ?q=&category=&source=&limit=&offset=
router.get('/popular', controller.popular); // rota específica antes de /:id
router.get('/:id', controller.getById);

// Alimentos personalizados: nutricionista/admin.
router.post('/', authorize(ROLES.NUTRITIONIST, ROLES.ADMIN), controller.create);
router.patch('/:id', authorize(ROLES.NUTRITIONIST, ROLES.ADMIN), controller.update);
router.delete('/:id', authorize(ROLES.NUTRITIONIST, ROLES.ADMIN), controller.remove);

module.exports = router;
