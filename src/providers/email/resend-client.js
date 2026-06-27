// src/providers/email/resend-client.js — cliente de e-mail transacional (Resend).
// Toda integração de e-mail passa por aqui (nunca direto no controller/service de HTTP).
// Em dev sem RESEND_API_KEY, faz no-op logado para não quebrar os fluxos.
const { Resend } = require('resend');
const env = require('../../config/env');

let client = null;
function getClient() {
  if (!env.RESEND_API_KEY) return null;
  if (!client) client = new Resend(env.RESEND_API_KEY);
  return client;
}

/**
 * Envia um e-mail. Retorna { id } do provider ou { skipped: true } se não configurado.
 * Não lança em falha de envio "soft": loga e devolve { error } para o chamador decidir.
 * @param {{ to: string|string[], subject: string, html: string, text?: string }} msg
 */
async function sendEmail({ to, subject, html, text }) {
  const resend = getClient();
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY ausente — e-mail "${subject}" para ${to} NÃO enviado (dev no-op).`);
    return { skipped: true };
  }

  try {
    const payload = {
      from: env.MAIL_FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    };
    if (text) payload.text = text;
    if (env.MAIL_REPLY_TO) payload.replyTo = env.MAIL_REPLY_TO;

    const { data, error } = await resend.emails.send(payload);
    if (error) {
      console.error('[email] Falha no envio via Resend:', error);
      return { error };
    }
    return { id: data?.id };
  } catch (err) {
    console.error('[email] Exceção ao enviar e-mail:', err);
    return { error: err };
  }
}

module.exports = { sendEmail };
