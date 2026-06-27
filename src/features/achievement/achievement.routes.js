// src/features/achievement/achievement.routes.js — conquistas/badges.
const { Router } = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const controller = require('./achievement.controller');

const router = Router();
router.use(authenticate);

router.get('/', controller.list); // ?patientProfileId= -> { catalog, unlocked }
router.post('/unlock', controller.unlock); // body: { patientProfileId, code }

module.exports = router;
