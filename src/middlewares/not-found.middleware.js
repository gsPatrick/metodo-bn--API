// src/middlewares/not-found.middleware.js — 404 para rotas não registradas.
const AppError = require('../utils/app-error');

module.exports = function notFoundHandler(req, res, next) {
  next(AppError.notFound(`Rota não encontrada: ${req.method} ${req.originalUrl}`, 'ROUTE_NOT_FOUND'));
};
