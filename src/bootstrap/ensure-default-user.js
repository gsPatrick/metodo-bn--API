// src/bootstrap/ensure-default-user.js
// Garante que a nutricionista padrão exista (idempotente).
// Configurada por DEFAULT_NUTRI_EMAIL / DEFAULT_NUTRI_PASSWORD / DEFAULT_NUTRI_NAME.
// Executado no boot (app.js). Não sobrescreve um usuário já existente.
const env = require('../config/env');
const { User } = require('../models');
const { ROLES } = require('../config/constants');

async function ensureDefaultNutritionist() {
  const email = (env.DEFAULT_NUTRI_EMAIL || '').trim().toLowerCase();
  const password = env.DEFAULT_NUTRI_PASSWORD;
  if (!email || !password) {
    return; // nada configurado — silencioso.
  }

  const existing = await User.findOne({ where: { email } });
  if (existing) {
    return; // já existe — não toca em nada.
  }

  const user = User.build({
    name: env.DEFAULT_NUTRI_NAME || 'Nutricionista',
    email,
    role: ROLES.NUTRITIONIST,
    isActive: true,
  });
  await user.setPassword(password);
  await user.save();
  console.log(`[seed] Nutricionista padrão criada: ${email}`);
}

module.exports = { ensureDefaultNutritionist };
