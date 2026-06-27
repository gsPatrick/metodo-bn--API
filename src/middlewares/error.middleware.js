// src/middlewares/error.middleware.js — handler de erro global (último middleware).
const AppError = require('../utils/app-error');
const env = require('../config/env');

// eslint-disable-next-line no-unused-vars (Express exige a assinatura de 4 args)
module.exports = function errorHandler(err, req, res, next) {
  let error = err;

  // Normaliza erros conhecidos do Sequelize para AppError.
  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    const details = err.errors?.map((e) => ({ field: e.path, message: e.message }));
    error = new AppError('Falha de validação.', 422, 'VALIDATION_ERROR', details);
  } else if (err.name === 'SequelizeForeignKeyConstraintError') {
    error = new AppError('Referência inválida.', 409, 'FK_CONSTRAINT');
  } else if (err.name === 'GatewayError') {
    // Erro do gateway de pagamento (Asaas) — não vaza payload bruto ao cliente.
    error = new AppError(
      err.message || 'Falha no gateway de pagamento.',
      err.status && err.status >= 400 ? err.status : 502,
      'PAYMENT_GATEWAY_ERROR',
    );
  } else if (!(err instanceof AppError)) {
    // Erro inesperado (bug): não vaza detalhes internos ao cliente.
    error = new AppError(
      env.NODE_ENV === 'production' ? 'Erro interno do servidor.' : err.message,
      500,
      'INTERNAL_ERROR',
    );
  }

  if (!error.isOperational || error.statusCode >= 500) {
    console.error('[error]', err);
  }

  const body = {
    success: false,
    error: {
      code: error.code,
      message: error.message,
    },
  };
  if (error.details) body.error.details = error.details;
  if (env.NODE_ENV !== 'production' && error.statusCode >= 500) {
    body.error.stack = err.stack;
  }

  return res.status(error.statusCode || 500).json(body);
};
