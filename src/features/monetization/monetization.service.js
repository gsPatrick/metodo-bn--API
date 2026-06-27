// src/features/monetization/monetization.service.js — configuração liga/desliga.
// Controla se os pacientes de uma nutricionista precisam de assinatura ativa
// para acessar plano alimentar e lista de compras.
const { Op } = require('sequelize');
const { MonetizationConfig, Subscription, PatientProfile } = require('../../models');
const AppError = require('../../utils/app-error');
const { ROLES, SUBSCRIPTION_STATUS } = require('../../config/constants');

// --- Configuração por nutricionista ------------------------------------

async function getConfig(actor, nutritionistId) {
  const targetId = actor.role === ROLES.ADMIN && nutritionistId ? nutritionistId : actor.id;
  if (actor.role === ROLES.PATIENT) throw AppError.forbidden();
  const config = await MonetizationConfig.findOne({ where: { nutritionistId: targetId } });
  // Sem config = monetização desligada (acesso livre).
  return config || { nutritionistId: targetId, isEnabled: false, gatewayAccountId: null, notes: null };
}

async function setConfig(actor, { isEnabled, gatewayAccountId, notes, nutritionistId }) {
  if (actor.role !== ROLES.NUTRITIONIST && actor.role !== ROLES.ADMIN) {
    throw AppError.forbidden('Apenas nutricionistas/admin configuram monetização.', 'NOT_ALLOWED');
  }
  const targetId = actor.role === ROLES.ADMIN && nutritionistId ? nutritionistId : actor.id;

  const [config] = await MonetizationConfig.findOrCreate({
    where: { nutritionistId: targetId },
    defaults: { nutritionistId: targetId, isEnabled: Boolean(isEnabled) },
  });
  if (isEnabled !== undefined) config.isEnabled = Boolean(isEnabled);
  if (gatewayAccountId !== undefined) config.gatewayAccountId = gatewayAccountId;
  if (notes !== undefined) config.notes = notes;
  await config.save();
  return config;
}

// --- Regras de acesso ---------------------------------------------------

// Monetização habilitada para a nutricionista? (config específica → global → off)
async function isEnabledForNutritionist(nutritionistId) {
  const specific = await MonetizationConfig.findOne({ where: { nutritionistId } });
  if (specific) return specific.isEnabled;
  const global = await MonetizationConfig.findOne({ where: { nutritionistId: null } });
  return global ? global.isEnabled : false;
}

// Paciente possui assinatura ativa e vigente?
async function patientHasActiveSubscription(patientProfileId) {
  const sub = await Subscription.findOne({
    where: {
      patientProfileId,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      [Op.or]: [{ currentPeriodEnd: null }, { currentPeriodEnd: { [Op.gt]: new Date() } }],
    },
    order: [['currentPeriodEnd', 'DESC']],
  });
  return Boolean(sub);
}

// Decisão de acesso para um usuário-paciente.
async function checkPatientAccess(userId) {
  const profile = await PatientProfile.findOne({ where: { userId } });
  if (!profile) return { allowed: true, reason: 'NO_PROFILE', monetizationEnabled: false, hasSubscription: false };

  const monetizationEnabled = await isEnabledForNutritionist(profile.nutritionistId);
  if (!monetizationEnabled) {
    return { allowed: true, reason: 'MONETIZATION_DISABLED', monetizationEnabled: false, hasSubscription: false };
  }
  const hasSubscription = await patientHasActiveSubscription(profile.id);
  return {
    allowed: hasSubscription,
    reason: hasSubscription ? 'ACTIVE_SUBSCRIPTION' : 'SUBSCRIPTION_REQUIRED',
    monetizationEnabled: true,
    hasSubscription,
    patientProfileId: profile.id,
  };
}

module.exports = {
  getConfig,
  setConfig,
  isEnabledForNutritionist,
  patientHasActiveSubscription,
  checkPatientAccess,
};
