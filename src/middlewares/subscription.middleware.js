// src/middlewares/subscription.middleware.js — gate de assinatura ativa.
// Só restringe pacientes: se a monetização da nutricionista estiver ligada e o
// paciente não tiver assinatura ativa, bloqueia o acesso ao recurso.
// Nutricionistas e admin passam direto (no-op).
const monetizationService = require('../features/monetization/monetization.service');
const AppError = require('../utils/app-error');
const { ROLES } = require('../config/constants');

async function requireActiveSubscription(req, res, next) {
  try {
    if (!req.user || req.user.role !== ROLES.PATIENT) return next();

    const decision = await monetizationService.checkPatientAccess(req.user.id);
    if (decision.allowed) return next();

    throw AppError.forbidden(
      'Assinatura ativa necessária para acessar este recurso.',
      'SUBSCRIPTION_REQUIRED',
    );
  } catch (err) {
    next(err);
  }
}

module.exports = { requireActiveSubscription };
