// src/providers/email/mailer.js — facade de e-mails transacionais.
// Combina templates + cliente Resend. É o ponto único usado pelos services.
const { sendEmail } = require('./resend-client');
const templates = require('./templates');

async function sendWelcome(user) {
  const { subject, html, text } = templates.welcome({ name: user.name });
  return sendEmail({ to: user.email, subject, html, text });
}

async function sendPasswordReset(user, { resetUrl, expiresInMin }) {
  const { subject, html, text } = templates.passwordReset({
    name: user.name,
    resetUrl,
    expiresInMin,
  });
  return sendEmail({ to: user.email, subject, html, text });
}

async function sendPasswordChanged(user) {
  const { subject, html, text } = templates.passwordChanged({ name: user.name });
  return sendEmail({ to: user.email, subject, html, text });
}

async function sendPatientInvite(user, { nutritionistName, tempPassword }) {
  const { subject, html, text } = templates.patientInvite({
    name: user.name,
    nutritionistName,
    email: user.email,
    tempPassword,
  });
  return sendEmail({ to: user.email, subject, html, text });
}

module.exports = { sendWelcome, sendPasswordReset, sendPasswordChanged, sendPatientInvite };
