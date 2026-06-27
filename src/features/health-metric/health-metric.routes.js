// src/features/health-metric/health-metric.routes.js — rotas de hábitos diários.
const { Router } = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const controller = require('./health-metric.controller');

const router = Router();

router.use(authenticate);

// Upsert do dia (unicidade por paciente+data garantida no service).
router.post('/', controller.upsert); // body: { patientProfileId, date?, sleepHours, steps, waterMl, stressLevel, dietAdherence }

// Consultas (rotas específicas antes da por data).
router.get('/', controller.list); // ?patientProfileId=&from=&to=
router.get('/summary', controller.summary); // ?patientProfileId=&from=&to=
router.get('/:date', controller.getByDate); // ?patientProfileId=  (date = YYYY-MM-DD)

module.exports = router;
