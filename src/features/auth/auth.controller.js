// src/features/auth/auth.controller.js — camada HTTP de autenticação.
// Só faz parsing de req, monta context (UA/IP) e formata a resposta.
const catchAsync = require('../../utils/catch-async');
const { ok, created } = require('../../utils/http-response');
const { sanitizeUser } = require('./auth.helper');
const authService = require('./auth.service');

// Contexto de sessão para auditoria do refresh token.
function sessionContext(req) {
  return {
    userAgent: req.headers['user-agent'] || null,
    ipAddress: req.ip || req.connection?.remoteAddress || null,
  };
}

const register = catchAsync(async (req, res) => {
  const { name, email, password, role, phone } = req.body;
  const result = await authService.register(
    { name, email, password, role, phone },
    sessionContext(req),
  );
  return created(res, result);
});

const login = catchAsync(async (req, res) => {
  const { email, phone, identifier, password } = req.body;
  const result = await authService.login({ email, phone, identifier, password }, sessionContext(req));
  return ok(res, result);
});

const refresh = catchAsync(async (req, res) => {
  const result = await authService.refresh(
    { refreshToken: req.body.refreshToken },
    sessionContext(req),
  );
  return ok(res, result);
});

const logout = catchAsync(async (req, res) => {
  const result = await authService.logout({ refreshToken: req.body.refreshToken });
  return ok(res, result);
});

const logoutAll = catchAsync(async (req, res) => {
  const result = await authService.logoutAll(req.user.id);
  return ok(res, result);
});

const forgotPassword = catchAsync(async (req, res) => {
  const result = await authService.forgotPassword({ email: req.body.email });
  return ok(res, result);
});

const resetPassword = catchAsync(async (req, res) => {
  const result = await authService.resetPassword({
    token: req.body.token,
    password: req.body.password,
  });
  return ok(res, result);
});

// Usuário autenticado atual (req.user vem do middleware authenticate).
const me = catchAsync(async (req, res) => {
  return ok(res, sanitizeUser(req.user));
});

module.exports = {
  register,
  login,
  refresh,
  logout,
  logoutAll,
  forgotPassword,
  resetPassword,
  me,
};
