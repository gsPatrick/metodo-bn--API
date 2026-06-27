// src/features/messaging/messaging.routes.js — chat nutri <-> paciente.
const { Router } = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const controller = require('./messaging.controller');

const router = Router();
router.use(authenticate);

router.get('/', controller.list); // conversas do usuário
router.post('/', controller.open); // body: { patientProfileId } -> cria/retorna conversa
router.get('/:id/messages', controller.messages); // ?before=&limit=
router.post('/:id/messages', controller.send); // body: { type, body?, attachmentUrl?, attachmentName?, attachmentSize?, durationSec? }
router.patch('/:id/read', controller.read);

module.exports = router;
