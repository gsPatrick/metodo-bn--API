// src/features/user/user.routes.js — rotas da feature user.
// RBAC grosso por papel aqui; ownership fino (nutri↔paciente) no service.
const { Router } = require('express');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { ROLES } = require('../../config/constants');
const controller = require('./user.controller');

const router = Router();

// Todas exigem autenticação.
router.use(authenticate);

// --- Perfil do próprio paciente (rota específica antes de /:id) ---
router.get('/me/profile', controller.getMyProfile);

// --- Pacientes da nutricionista (lista) e provisionamento ---
router.get('/patients', authorize(ROLES.NUTRITIONIST, ROLES.ADMIN), controller.listMyPatients);
router.post('/patients', authorize(ROLES.NUTRITIONIST, ROLES.ADMIN), controller.provisionPatient);

// --- PatientProfile ---
router.get('/profiles/:profileId', controller.getProfile);
router.patch('/profiles/:profileId', controller.updateProfile);

// --- PatientRestriction (aninhadas ao perfil + atalhos por id) ---
router.get('/profiles/:profileId/restrictions', controller.listRestrictions);
router.post('/profiles/:profileId/restrictions', controller.addRestriction);
router.patch('/restrictions/:restrictionId', controller.updateRestriction);
router.delete('/restrictions/:restrictionId', controller.removeRestriction);

// --- Administração de usuários (admin) ---
router.get('/', authorize(ROLES.ADMIN), controller.list);
router.post('/', authorize(ROLES.ADMIN), controller.create);
router.patch('/:id/active', authorize(ROLES.ADMIN), controller.setActive);
router.patch('/:id/role', authorize(ROLES.ADMIN), controller.updateRole);

// --- Genéricas por id (ownership validado no service) ---
router.get('/:id', controller.getById);
router.patch('/:id', controller.update);

module.exports = router;
