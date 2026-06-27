// src/providers/payment-gateway/payment-client.js — cliente HTTP do gateway.
// Toda integração externa de pagamento passa por aqui (nunca direto no controller).
// Implementação concreta depende de PAYMENT_PROVIDER (asaas/stripe/pagarme).
const env = require('../../config/env');

// Usa fetch global (Node >= 18).
async function request(path, { method = 'GET', body } = {}) {
  if (!env.PAYMENT_API_URL || !env.PAYMENT_API_KEY) {
    throw new Error('[payment] Gateway não configurado (PAYMENT_API_URL/PAYMENT_API_KEY).');
  }
  const res = await fetch(`${env.PAYMENT_API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      access_token: env.PAYMENT_API_KEY, // header de exemplo (Asaas)
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`[payment] Gateway respondeu ${res.status}`);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

// Funções de alto nível usadas pelos services de monetização.
async function createCustomer({ name, email, cpfCnpj }) {
  return request('/customers', { method: 'POST', body: { name, email, cpfCnpj } });
}

async function createCharge({ customerId, value, billingType, dueDate }) {
  return request('/payments', {
    method: 'POST',
    body: { customer: customerId, value, billingType, dueDate },
  });
}

module.exports = { request, createCustomer, createCharge };
