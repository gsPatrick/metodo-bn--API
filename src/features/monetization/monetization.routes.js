// src/features/monetization/monetization.routes.js — rotas da config de monetização.
const { Router } = require('express');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { ROLES } = require('../../config/constants');
const controller = require('./monetization.controller');

const router = Router();

router.use(authenticate);

// Config liga/desliga (nutricionista/admin).
router.get('/config', authorize(ROLES.NUTRITIONIST, ROLES.ADMIN), controller.getConfig);
router.put('/config', authorize(ROLES.NUTRITIONIST, ROLES.ADMIN), controller.setConfig);

// Status de acesso do paciente (paywall do app).
router.get('/access', controller.myAccess);

module.exports = router;
