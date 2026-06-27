// src/utils/app-error.js — erro operacional com statusCode e code estável.
// O `code` é um identificador textual estável para o cliente reagir
// programaticamente (ex: 'USER_NOT_FOUND'), independente da mensagem.
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true; // distingue erros previstos de bugs inesperados.
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, code = 'BAD_REQUEST', details = null) {
    return new AppError(message, 400, code, details);
  }

  static unauthorized(message = 'Não autenticado.', code = 'UNAUTHORIZED') {
    return new AppError(message, 401, code);
  }

  static forbidden(message = 'Acesso negado.', code = 'FORBIDDEN') {
    return new AppError(message, 403, code);
  }

  static notFound(message = 'Recurso não encontrado.', code = 'NOT_FOUND') {
    return new AppError(message, 404, code);
  }

  static conflict(message, code = 'CONFLICT') {
    return new AppError(message, 409, code);
  }
}

module.exports = AppError;
