// src/features/auth/auth.service.js — regras de autenticação e sessão.
// Registro, login, refresh com rotação, logout, recuperação/reset de senha.
// E-mails transacionais via provider Resend (mailer).
const { Op } = require('sequelize');
const { User, RefreshToken, PasswordResetToken, sequelize } = require('../../models');
const AppError = require('../../utils/app-error');
const env = require('../../config/env');
const { ROLES } = require('../../config/constants');
const mailer = require('../../providers/email/mailer');
const {
  signAccessToken,
  generateOpaqueToken,
  hashToken,
  refreshExpiryDate,
  passwordResetExpiryDate,
  sanitizeUser,
} = require('./auth.helper');

// Cria uma sessão: persiste o hash do refresh token e devolve o par de tokens.
async function issueSession(user, context = {}, transaction = null) {
  const { raw, hash } = generateOpaqueToken();
  await RefreshToken.create(
    {
      userId: user.id,
      tokenHash: hash,
      expiresAt: refreshExpiryDate(),
      userAgent: context.userAgent || null,
      ipAddress: context.ipAddress || null,
    },
    { transaction },
  );

  return {
    accessToken: signAccessToken(user),
    refreshToken: raw,
    tokenType: 'Bearer',
    accessTokenExpiresIn: env.ACCESS_TOKEN_EXPIRES_IN,
  };
}

// ----------------------------------------------------------------- register
async function register({ name, email, password, role, phone }, context = {}) {
  if (!name || !email || !password) {
    throw AppError.badRequest('name, email e password são obrigatórios.', 'MISSING_FIELDS');
  }
  if (password.length < 8) {
    throw AppError.badRequest('A senha deve ter ao menos 8 caracteres.', 'WEAK_PASSWORD');
  }

  // admin nunca é auto-criável; valida contra a allowlist de registro.
  const requestedRole = role || ROLES.NUTRITIONIST;
  if (requestedRole === ROLES.ADMIN || !env.ALLOWED_SELF_REGISTER_ROLES.includes(requestedRole)) {
    throw AppError.forbidden('Papel não permitido no registro.', 'ROLE_NOT_ALLOWED');
  }

  const exists = await User.findOne({ where: { email } });
  if (exists) throw AppError.conflict('E-mail já cadastrado.', 'EMAIL_TAKEN');

  const session = await sequelize.transaction(async (t) => {
    const user = User.build({ name, email, phone, role: requestedRole });
    await user.setPassword(password);
    await user.save({ transaction: t });
    const tokens = await issueSession(user, context, t);
    return { user, tokens };
  });

  // E-mail de boas-vindas é "best effort": não falha o registro se o envio falhar.
  await mailer.sendWelcome(session.user).catch((e) => console.error('[auth] welcome email', e));

  return { user: sanitizeUser(session.user), ...session.tokens };
}

// -------------------------------------------------------------------- login
async function login({ email, password }, context = {}) {
  if (!email || !password) {
    throw AppError.badRequest('email e password são obrigatórios.', 'MISSING_FIELDS');
  }

  const user = await User.scope('withPassword').findOne({ where: { email } });
  if (!user || !user.isActive) {
    throw AppError.unauthorized('Credenciais inválidas.', 'INVALID_CREDENTIALS');
  }
  const valid = await user.validatePassword(password);
  if (!valid) {
    throw AppError.unauthorized('Credenciais inválidas.', 'INVALID_CREDENTIALS');
  }

  user.lastLoginAt = new Date();
  await user.save();

  const tokens = await issueSession(user, context);
  return { user: sanitizeUser(user), ...tokens };
}

// ------------------------------------------------------------------ refresh
// Verifica o refresh token, faz ROTAÇÃO (revoga o atual, emite novo) e detecta reuso.
async function refresh({ refreshToken }, context = {}) {
  if (!refreshToken) {
    throw AppError.badRequest('refreshToken é obrigatório.', 'MISSING_REFRESH_TOKEN');
  }
  const incomingHash = hashToken(refreshToken);

  return sequelize.transaction(async (t) => {
    const stored = await RefreshToken.findOne({ where: { tokenHash: incomingHash }, transaction: t });
    if (!stored) {
      throw AppError.unauthorized('Refresh token inválido.', 'REFRESH_TOKEN_INVALID');
    }

    // Detecção de reuso: token já revogado sendo reapresentado → revoga toda a família.
    if (stored.revokedAt) {
      await RefreshToken.update(
        { revokedAt: new Date() },
        { where: { userId: stored.userId, revokedAt: null }, transaction: t },
      );
      throw AppError.unauthorized('Refresh token reutilizado — sessões revogadas.', 'REFRESH_TOKEN_REUSED');
    }

    if (stored.isExpired()) {
      throw AppError.unauthorized('Refresh token expirado.', 'REFRESH_TOKEN_EXPIRED');
    }

    const user = await User.findByPk(stored.userId, { transaction: t });
    if (!user || !user.isActive) {
      throw AppError.unauthorized('Usuário inativo ou inexistente.', 'USER_INACTIVE');
    }

    // Emite o novo token e encadeia a rotação.
    const { raw, hash } = generateOpaqueToken();
    await RefreshToken.create(
      {
        userId: user.id,
        tokenHash: hash,
        expiresAt: refreshExpiryDate(),
        userAgent: context.userAgent || null,
        ipAddress: context.ipAddress || null,
      },
      { transaction: t },
    );
    stored.revokedAt = new Date();
    stored.replacedByTokenHash = hash;
    await stored.save({ transaction: t });

    return {
      user: sanitizeUser(user),
      accessToken: signAccessToken(user),
      refreshToken: raw,
      tokenType: 'Bearer',
      accessTokenExpiresIn: env.ACCESS_TOKEN_EXPIRES_IN,
    };
  });
}

// ------------------------------------------------------------------- logout
async function logout({ refreshToken }) {
  if (!refreshToken) return { revoked: false };
  const hash = hashToken(refreshToken);
  const [count] = await RefreshToken.update(
    { revokedAt: new Date() },
    { where: { tokenHash: hash, revokedAt: null } },
  );
  return { revoked: count > 0 };
}

// Revoga TODAS as sessões ativas do usuário.
async function logoutAll(userId) {
  const [count] = await RefreshToken.update(
    { revokedAt: new Date() },
    { where: { userId, revokedAt: null } },
  );
  return { revokedCount: count };
}

// ----------------------------------------------------------- forgotPassword
// Sempre responde sucesso (evita enumeração de e-mails). Só envia se existir.
async function forgotPassword({ email }) {
  if (!email) throw AppError.badRequest('email é obrigatório.', 'MISSING_FIELDS');

  const user = await User.findOne({ where: { email } });
  if (user && user.isActive) {
    // Invalida tokens de reset anteriores ainda válidos.
    await PasswordResetToken.update(
      { usedAt: new Date() },
      { where: { userId: user.id, usedAt: null } },
    );

    const { raw, hash } = generateOpaqueToken();
    await PasswordResetToken.create({
      userId: user.id,
      tokenHash: hash,
      expiresAt: passwordResetExpiryDate(),
    });

    const resetUrl = `${env.APP_WEB_URL}/reset-password?token=${raw}`;
    await mailer
      .sendPasswordReset(user, { resetUrl, expiresInMin: env.PASSWORD_RESET_EXPIRES_MIN })
      .catch((e) => console.error('[auth] reset email', e));
  }

  return { message: 'Se o e-mail existir, enviaremos as instruções de recuperação.' };
}

// ------------------------------------------------------------ resetPassword
async function resetPassword({ token, password }) {
  if (!token || !password) {
    throw AppError.badRequest('token e password são obrigatórios.', 'MISSING_FIELDS');
  }
  if (password.length < 8) {
    throw AppError.badRequest('A senha deve ter ao menos 8 caracteres.', 'WEAK_PASSWORD');
  }

  const hash = hashToken(token);
  const user = await sequelize.transaction(async (t) => {
    const reset = await PasswordResetToken.findOne({ where: { tokenHash: hash }, transaction: t });
    if (!reset || !reset.isUsable()) {
      throw AppError.badRequest('Token de recuperação inválido ou expirado.', 'RESET_TOKEN_INVALID');
    }

    const u = await User.scope('withPassword').findByPk(reset.userId, { transaction: t });
    if (!u) throw AppError.notFound('Usuário não encontrado.', 'USER_NOT_FOUND');

    await u.setPassword(password);
    await u.save({ transaction: t });

    reset.usedAt = new Date();
    await reset.save({ transaction: t });

    // Segurança: invalida todas as sessões ativas após troca de senha.
    await RefreshToken.update(
      { revokedAt: new Date() },
      { where: { userId: u.id, revokedAt: null }, transaction: t },
    );
    return u;
  });

  await mailer.sendPasswordChanged(user).catch((e) => console.error('[auth] changed email', e));

  return { message: 'Senha redefinida com sucesso.' };
}

// Limpeza opcional de tokens expirados/revogados (uso por job/cron).
async function purgeExpiredTokens() {
  const now = new Date();
  const refreshDeleted = await RefreshToken.destroy({
    where: { [Op.or]: [{ expiresAt: { [Op.lt]: now } }, { revokedAt: { [Op.ne]: null } }] },
  });
  const resetDeleted = await PasswordResetToken.destroy({
    where: { [Op.or]: [{ expiresAt: { [Op.lt]: now } }, { usedAt: { [Op.ne]: null } }] },
  });
  return { refreshDeleted, resetDeleted };
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  logoutAll,
  forgotPassword,
  resetPassword,
  purgeExpiredTokens,
};
