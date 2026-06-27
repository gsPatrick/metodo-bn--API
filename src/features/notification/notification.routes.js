// src/features/notification/notification.routes.js — rotas de notificações.
const { Router } = require('express');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { ROLES } = require('../../config/constants');
const controller = require('./notification.controller');

const router = Router();

router.use(authenticate);

// Notificações do próprio usuário autenticado.
router.get('/', controller.list);
router.get('/unread-count', controller.unreadCount);
router.patch('/read-all', controller.markAllRead);
router.patch('/:id/read', controller.markAsRead);
router.delete('/:id', controller.remove);

// Envio manual (admin/nutricionista).
router.post('/', authorize(ROLES.ADMIN, ROLES.NUTRITIONIST), controller.send);

module.exports = router;
