// src/middlewares/auth.middleware.js — autenticação JWT + autorização por papel (RBAC).
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const AppError = require('../utils/app-error');
const { User } = require('../models');

// Verifica o Bearer token e carrega o usuário em req.user.
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw AppError.unauthorized('Token ausente ou malformado.', 'TOKEN_MISSING');
    }

    let payload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET);
    } catch (err) {
      throw AppError.unauthorized('Token inválido ou expirado.', 'TOKEN_INVALID');
    }

    const user = await User.findByPk(payload.sub);
    if (!user || !user.isActive) {
      throw AppError.unauthorized('Usuário inativo ou inexistente.', 'USER_INACTIVE');
    }

    req.user = user;
    req.auth = { userId: user.id, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
}

// Restringe o acesso a papéis específicos. Uso: authorize('admin', 'nutritionist')
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(AppError.unauthorized());
    }
    if (allowedRoles.length && !allowedRoles.includes(req.user.role)) {
      return next(AppError.forbidden('Papel sem permissão para esta ação.', 'ROLE_FORBIDDEN'));
    }
    return next();
  };
}

module.exports = { authenticate, authorize };
