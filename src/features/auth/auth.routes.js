// src/features/auth/auth.routes.js — rotas de autenticação e sessão.
const { Router } = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const controller = require('./auth.controller');

const router = Router();

// --- Públicas ---
router.post('/register', controller.register);
router.post('/login', controller.login);
router.post('/refresh', controller.refresh);
router.post('/logout', controller.logout); // revoga um refresh token específico
router.post('/forgot-password', controller.forgotPassword);
router.post('/reset-password', controller.resetPassword);

// --- Protegidas (Bearer) ---
router.get('/me', authenticate, controller.me);
router.post('/logout-all', authenticate, controller.logoutAll); // revoga todas as sessões

module.exports = router;
