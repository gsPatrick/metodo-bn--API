// src/providers/payment-gateway/asaas-client.js — integração com o gateway Asaas.
// Foco no mercado brasileiro (Pix e boleto). Toda chamada externa de cobrança
// passa por aqui; o billing.service nunca fala HTTP diretamente.
// Usa fetch global (Node >= 18).
const env = require('../../config/env');

// Erro de gateway — capturado e mapeado para 502 no handler de erro global.
class GatewayError extends Error {
  constructor(message, status = 502, payload = null) {
    super(message);
    this.name = 'GatewayError';
    this.status = status;
    this.payload = payload;
  }
}

function isConfigured() {
  return Boolean(env.PAYMENT_API_URL && env.PAYMENT_API_KEY);
}

async function request(path, { method = 'GET', body } = {}) {
  if (!isConfigured()) {
    throw new GatewayError('Gateway Asaas não configurado (PAYMENT_API_URL/PAYMENT_API_KEY).', 503);
  }
  let res;
  try {
    res = await fetch(`${env.PAYMENT_API_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        access_token: env.PAYMENT_API_KEY,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new GatewayError(`Falha de conexão com o Asaas: ${err.message}`, 502);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.errors?.[0]?.description || `Asaas respondeu ${res.status}`;
    throw new GatewayError(msg, 502, data);
  }
  return data;
}

// Converte o ciclo em dias para o enum de ciclo do Asaas.
function mapCycle(cycleDays) {
  const map = { 7: 'WEEKLY', 14: 'BIWEEKLY', 30: 'MONTHLY', 60: 'BIMONTHLY', 90: 'QUARTERLY', 180: 'SEMIANNUALLY', 365: 'YEARLY' };
  return map[Number(cycleDays)] || 'MONTHLY';
}

// Mapeia o billingType do Asaas para o enum interno de método de pagamento.
function mapBillingTypeToMethod(billingType) {
  const map = { PIX: 'pix', BOLETO: 'boleto', CREDIT_CARD: 'credit_card' };
  return map[billingType] || 'pix';
}

// Data de hoje em YYYY-MM-DD (vencimento imediato para Pix).
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// --- Operações de alto nível -------------------------------------------

async function createCustomer({ name, email, cpfCnpj, phone }) {
  return request('/customers', {
    method: 'POST',
    body: { name, email, cpfCnpj: cpfCnpj || undefined, mobilePhone: phone || undefined },
  });
}

// Cria uma cobrança avulsa (primeira parcela) — billingType PIX por padrão.
async function createPayment({ customerId, value, dueDate, description, billingType = 'PIX', externalReference }) {
  return request('/payments', {
    method: 'POST',
    body: {
      customer: customerId,
      billingType,
      value,
      dueDate: dueDate || todayISO(),
      description,
      externalReference,
    },
  });
}

// Recupera o QR Code / copia-e-cola Pix de uma cobrança.
async function getPixQrCode(paymentId) {
  return request(`/payments/${paymentId}/pixQrCode`);
}

// Cria a assinatura recorrente no Asaas.
async function createSubscription({ customerId, value, cycleDays, description, billingType = 'PIX', nextDueDate }) {
  return request('/subscriptions', {
    method: 'POST',
    body: {
      customer: customerId,
      billingType,
      value,
      cycle: mapCycle(cycleDays),
      nextDueDate: nextDueDate || todayISO(),
      description,
    },
  });
}

// Cancela uma assinatura no Asaas.
async function cancelSubscription(subscriptionId) {
  return request(`/subscriptions/${subscriptionId}`, { method: 'DELETE' });
}

// Validação do webhook: o Asaas envia o token configurado no header.
function validateWebhookToken(headers = {}) {
  if (!env.PAYMENT_WEBHOOK_SECRET) return true; // sem segredo configurado → aceita (dev)
  const token = headers['asaas-access-token'] || headers['Asaas-Access-Token'];
  return token === env.PAYMENT_WEBHOOK_SECRET;
}

module.exports = {
  GatewayError,
  isConfigured,
  createCustomer,
  createPayment,
  getPixQrCode,
  createSubscription,
  cancelSubscription,
  validateWebhookToken,
  mapBillingTypeToMethod,
  mapCycle,
};
