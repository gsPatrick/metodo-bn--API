// src/features/anamnesis/anamnesis.routes.js — rotas do prontuário de anamnese.
// Acesso por ownership; edição restrita a nutricionista/admin (validado no service).
const { Router } = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const controller = require('./anamnesis.controller');

const router = Router();

router.use(authenticate);

// Rotas literais específicas (antes de /:patientProfileId).
router.get('/schema', controller.schema); // catálogo do questionário guiado
router.delete('/assessments/:assessmentId', controller.removeAssessment);

// Prontuário-mestre.
router.get('/:patientProfileId', controller.get);
router.put('/:patientProfileId', controller.upsert);
router.get('/:patientProfileId/golden-rule', controller.goldenRule);
router.get('/:patientProfileId/report', controller.report);
router.get('/:patientProfileId/report.html', controller.reportHtml);

// Avaliações antropométricas (longitudinal).
router.get('/:patientProfileId/assessments', controller.listAssessments);
router.post('/:patientProfileId/assessments', controller.addAssessment);

// Exames bioquímicos.
router.get('/:patientProfileId/exams', controller.listExams);
router.post('/:patientProfileId/exams', controller.addExam);

// Evolução nutricional.
router.get('/:patientProfileId/evolutions', controller.listEvolutions);
router.post('/:patientProfileId/evolutions', controller.addEvolution);

module.exports = router;
