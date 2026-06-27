// src/features/auth/auth.helper.js — utilitários de tokens (JWT + opacos).
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');

// Access token JWT curto. payload.sub = userId (compatível com auth.middleware).
function signAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN,
  });
}

// Gera um token opaco aleatório (refresh / reset) e seu hash SHA-256.
function generateOpaqueToken() {
  const raw = crypto.randomBytes(48).toString('hex');
  return { raw, hash: hashToken(raw) };
}

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// Datas de expiração calculadas a partir do env.
function refreshExpiryDate() {
  const ms = env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000;
  return new Date(Date.now() + ms);
}

function passwordResetExpiryDate() {
  const ms = env.PASSWORD_RESET_EXPIRES_MIN * 60 * 1000;
  return new Date(Date.now() + ms);
}

// Remove campos sensíveis de uma instância/objeto de usuário.
function sanitizeUser(user) {
  const obj = typeof user.toJSON === 'function' ? user.toJSON() : { ...user };
  delete obj.passwordHash;
  return obj;
}

module.exports = {
  signAccessToken,
  generateOpaqueToken,
  hashToken,
  refreshExpiryDate,
  passwordResetExpiryDate,
  sanitizeUser,
};
