// src/features/reminder/reminder.routes.js — lembretes do paciente.
const { Router } = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const controller = require('./reminder.controller');

const router = Router();
router.use(authenticate);

router.get('/', controller.list); // ?patientProfileId=
router.post('/', controller.create); // body: { patientProfileId, type, title, timeOfDay?, enabled? }
router.patch('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
