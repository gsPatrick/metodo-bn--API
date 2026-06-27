// src/features/billing/billing.service.js — planos, assinaturas e gateway Asaas.
// Gestão de PaymentPlan, criação de assinatura com cobrança Pix/boleto via Asaas
// e processamento de webhooks que ativam Subscription + registram PaymentTransaction.
const {
  PaymentPlan,
  Subscription,
  PaymentTransaction,
  PatientProfile,
  User,
  sequelize,
} = require('../../models');
const AppError = require('../../utils/app-error');
const { ROLES, SUBSCRIPTION_STATUS, PAYMENT_STATUS } = require('../../config/constants');
const asaas = require('../../providers/payment-gateway/asaas-client');
const notificationService = require('../notification/notification.service');

// --- Autorização --------------------------------------------------------

function assertProfileAccess(actor, profile) {
  if (!profile) throw AppError.notFound('Perfil não encontrado.', 'PROFILE_NOT_FOUND');
  if (actor.role === ROLES.ADMIN) return;
  if (actor.role === ROLES.NUTRITIONIST && profile.nutritionistId === actor.id) return;
  if (actor.role === ROLES.PATIENT && profile.userId === actor.id) return;
  throw AppError.forbidden('Sem permissão sobre esta assinatura.', 'BILLING_FORBIDDEN');
}

// --- Planos de cobrança (PaymentPlan) ----------------------------------

async function createPlan(actor, { name, description, price, cycleDays, currency }) {
  if (actor.role !== ROLES.NUTRITIONIST && actor.role !== ROLES.ADMIN) {
    throw AppError.forbidden('Apenas nutricionistas criam planos.', 'NOT_NUTRITIONIST');
  }
  if (!name || price == null) throw AppError.badRequest('name e price são obrigatórios.', 'MISSING_FIELDS');
  return PaymentPlan.create({
    nutritionistId: actor.id,
    name,
    description: description ?? null,
    price,
    cycleDays: cycleDays ?? 30,
    currency: currency || 'BRL',
  });
}

async function listPlans(actor, { nutritionistId } = {}) {
  const where = { isActive: true };
  if (actor.role === ROLES.NUTRITIONIST) where.nutritionistId = actor.id;
  else if (actor.role === ROLES.PATIENT) {
    const profile = await PatientProfile.findOne({ where: { userId: actor.id } });
    if (!profile) return [];
    where.nutritionistId = profile.nutritionistId; // planos da sua nutricionista
  } else if (nutritionistId) where.nutritionistId = nutritionistId;
  return PaymentPlan.findAll({ where, order: [['price', 'ASC']] });
}

async function loadOwnedPlan(actor, id) {
  const plan = await PaymentPlan.findByPk(id);
  if (!plan) throw AppError.notFound('Plano não encontrado.', 'PAYMENT_PLAN_NOT_FOUND');
  if (actor.role !== ROLES.ADMIN && plan.nutritionistId !== actor.id) {
    throw AppError.forbidden('Plano de outra nutricionista.', 'PAYMENT_PLAN_FORBIDDEN');
  }
  return plan;
}

async function updatePlan(actor, id, data) {
  const plan = await loadOwnedPlan(actor, id);
  ['name', 'description', 'price', 'cycleDays', 'currency', 'isActive'].forEach((f) => {
    if (data[f] !== undefined) plan[f] = data[f];
  });
  await plan.save();
  return plan;
}

async function removePlan(actor, id) {
  const plan = await loadOwnedPlan(actor, id);
  await plan.destroy();
  return { deleted: true };
}

// --- Assinatura + cobrança ---------------------------------------------

// Reaproveita o customer Asaas já criado para o paciente (evita duplicar).
async function findExistingCustomerId(patientProfileId) {
  const prev = await Subscription.findOne({
    where: { patientProfileId },
    order: [['createdAt', 'DESC']],
  });
  return prev && prev.gatewayCustomerId ? prev.gatewayCustomerId : null;
}

/**
 * Cria a assinatura do paciente e emite a primeira cobrança (Pix) no Asaas.
 * Retorna { subscription, transaction, pix } com copia-e-cola para pagamento.
 */
async function subscribe(actor, { patientProfileId, paymentPlanId, cpfCnpj, billingType = 'PIX' }) {
  const profile = await PatientProfile.findByPk(patientProfileId, {
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'phone'] }],
  });
  assertProfileAccess(actor, profile);

  const plan = await PaymentPlan.findByPk(paymentPlanId);
  if (!plan || !plan.isActive) throw AppError.notFound('Plano de cobrança inválido.', 'PAYMENT_PLAN_NOT_FOUND');
  if (plan.nutritionistId !== profile.nutritionistId) {
    throw AppError.badRequest('Plano não pertence à nutricionista do paciente.', 'PLAN_MISMATCH');
  }

  // 1. Cliente no Asaas (reusa se já existir).
  let customerId = await findExistingCustomerId(patientProfileId);
  if (!customerId) {
    const customer = await asaas.createCustomer({
      name: profile.user.name,
      email: profile.user.email,
      phone: profile.user.phone,
      cpfCnpj,
    });
    customerId = customer.id;
  }

  // 2. Assinatura recorrente (próxima cobrança após o ciclo) + 1ª cobrança imediata.
  const description = `Assinatura: ${plan.name}`;
  const nextDue = new Date(Date.now() + plan.cycleDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const gatewaySubscription = await asaas.createSubscription({
    customerId,
    value: Number(plan.price),
    cycleDays: plan.cycleDays,
    description,
    billingType,
    nextDueDate: nextDue,
  });
  const firstPayment = await asaas.createPayment({
    customerId,
    value: Number(plan.price),
    description: `${description} (1ª cobrança)`,
    billingType,
  });
  const pix = billingType === 'PIX' ? await asaas.getPixQrCode(firstPayment.id).catch(() => null) : null;

  // 3. Persistência local (status past_due = aguardando 1º pagamento).
  const { subscription, transaction } = await sequelize.transaction(async (t) => {
    const sub = await Subscription.create(
      {
        patientProfileId,
        paymentPlanId,
        status: SUBSCRIPTION_STATUS.PAST_DUE,
        gatewaySubscriptionId: gatewaySubscription.id,
        gatewayCustomerId: customerId,
        startedAt: new Date(),
      },
      { transaction: t },
    );
    const tx = await PaymentTransaction.create(
      {
        subscriptionId: sub.id,
        amount: Number(plan.price),
        currency: plan.currency,
        method: asaas.mapBillingTypeToMethod(billingType),
        status: PAYMENT_STATUS.PENDING,
        gatewayTransactionId: firstPayment.id,
        gatewayPayload: firstPayment,
      },
      { transaction: t },
    );
    return { subscription: sub, transaction: tx };
  });

  return {
    subscription,
    transaction,
    pix: pix
      ? { payload: pix.payload, encodedImage: pix.encodedImage, expirationDate: pix.expirationDate }
      : null,
  };
}

async function listSubscriptions(actor, { patientProfileId, status } = {}) {
  const where = {};
  if (status) where.status = status;
  if (actor.role === ROLES.PATIENT) {
    const profile = await PatientProfile.findOne({ where: { userId: actor.id } });
    if (!profile) return [];
    where.patientProfileId = profile.id;
  } else if (actor.role === ROLES.NUTRITIONIST) {
    const patients = await PatientProfile.findAll({ where: { nutritionistId: actor.id }, attributes: ['id'] });
    where.patientProfileId = patients.map((p) => p.id);
  } else if (patientProfileId) where.patientProfileId = patientProfileId;

  return Subscription.findAll({
    where,
    include: [{ model: PaymentPlan, as: 'plan' }],
    order: [['createdAt', 'DESC']],
  });
}

async function getSubscription(actor, id) {
  const sub = await Subscription.findByPk(id, {
    include: [
      { model: PaymentPlan, as: 'plan' },
      { model: PatientProfile, as: 'patient' },
      { model: PaymentTransaction, as: 'transactions' },
    ],
  });
  if (!sub) throw AppError.notFound('Assinatura não encontrada.', 'SUBSCRIPTION_NOT_FOUND');
  assertProfileAccess(actor, sub.patient);
  return sub;
}

async function cancelSubscription(actor, id) {
  const sub = await getSubscription(actor, id);
  sub.status = SUBSCRIPTION_STATUS.CANCELED;
  sub.canceledAt = new Date();
  await sub.save();
  // Cancela no gateway (best effort).
  if (sub.gatewaySubscriptionId && asaas.isConfigured()) {
    await asaas
      .cancelSubscription(sub.gatewaySubscriptionId)
      .catch((e) => console.error('[billing] cancel gateway', e.message));
  }
  return sub;
}

// --- Webhook do Asaas ---------------------------------------------------

// Mapeia o evento do Asaas para o status interno da transação + assinatura.
function mapEvent(event) {
  switch (event) {
    case 'PAYMENT_CONFIRMED':
      return { tx: PAYMENT_STATUS.CONFIRMED, activate: true };
    case 'PAYMENT_RECEIVED':
      return { tx: PAYMENT_STATUS.RECEIVED, activate: true };
    case 'PAYMENT_OVERDUE':
      return { tx: PAYMENT_STATUS.FAILED, overdue: true };
    case 'PAYMENT_REFUNDED':
      return { tx: PAYMENT_STATUS.REFUNDED };
    case 'PAYMENT_DELETED':
    case 'PAYMENT_CHARGEBACK_REQUESTED':
      return { tx: PAYMENT_STATUS.FAILED, overdue: true };
    default:
      return null;
  }
}

async function handleWebhook(payload, headers) {
  if (!asaas.validateWebhookToken(headers || {})) {
    throw AppError.unauthorized('Webhook não autorizado.', 'WEBHOOK_INVALID');
  }
  const event = payload && payload.event;
  const payment = payload && payload.payment;
  if (!payment || !payment.id) return { ignored: true, reason: 'NO_PAYMENT' };

  const mapped = mapEvent(event);
  if (!mapped) return { ignored: true, reason: `UNHANDLED_${event}` };

  // Localiza a transação pelo id do pagamento (idempotente) ou pela assinatura.
  let tx = await PaymentTransaction.findOne({
    where: { gatewayTransactionId: payment.id },
    include: [
      {
        model: Subscription,
        as: 'subscription',
        include: [{ model: PaymentPlan, as: 'plan' }, { model: PatientProfile, as: 'patient' }],
      },
    ],
  });

  if (!tx && payment.subscription) {
    const sub = await Subscription.findOne({
      where: { gatewaySubscriptionId: payment.subscription },
      include: [{ model: PaymentPlan, as: 'plan' }, { model: PatientProfile, as: 'patient' }],
    });
    if (sub) {
      tx = await PaymentTransaction.create({
        subscriptionId: sub.id,
        amount: Number(payment.value) || 0,
        currency: sub.plan ? sub.plan.currency : 'BRL',
        method: asaas.mapBillingTypeToMethod(payment.billingType),
        status: PAYMENT_STATUS.PENDING,
        gatewayTransactionId: payment.id,
      });
      tx.subscription = sub;
    }
  }
  if (!tx) return { ignored: true, reason: 'TX_NOT_FOUND' };

  const sub = tx.subscription;
  const plan = sub && sub.plan;

  await sequelize.transaction(async (t) => {
    tx.status = mapped.tx;
    tx.gatewayPayload = payment;
    if (mapped.activate) tx.paidAt = new Date();
    await tx.save({ transaction: t });

    if (sub) {
      if (mapped.activate) {
        const base = sub.currentPeriodEnd && sub.currentPeriodEnd > new Date() ? sub.currentPeriodEnd : new Date();
        const days = plan ? plan.cycleDays : 30;
        sub.status = SUBSCRIPTION_STATUS.ACTIVE;
        sub.currentPeriodEnd = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
        if (!sub.startedAt) sub.startedAt = new Date();
      } else if (mapped.overdue) {
        sub.status = SUBSCRIPTION_STATUS.PAST_DUE;
      }
      await sub.save({ transaction: t });
    }
  });

  // Notifica o paciente (best effort).
  if (sub && sub.patient && sub.patient.userId) {
    const ok = mapped.activate;
    await notificationService
      .notify({
        userId: sub.patient.userId,
        title: ok ? 'Pagamento confirmado' : 'Problema no pagamento',
        message: ok ? 'Sua assinatura está ativa.' : 'Não conseguimos confirmar seu pagamento.',
        type: ok ? 'payment_success' : 'payment_failed',
        metadata: { subscriptionId: sub.id, transactionId: tx.id },
      })
      .catch((e) => console.error('[billing] notify', e));
  }

  return { processed: true, status: tx.status };
}

module.exports = {
  createPlan,
  listPlans,
  updatePlan,
  removePlan,
  subscribe,
  listSubscriptions,
  getSubscription,
  cancelSubscription,
  handleWebhook,
};
