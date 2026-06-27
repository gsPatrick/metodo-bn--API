// src/utils/http-response.js — formato de resposta padronizado da API.
// Sucesso:  { success: true, data, meta? }
// Erro:     { success: false, error: { code, message, details? } }  (no error handler)
function ok(res, data = null, statusCode = 200, meta = undefined) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

function created(res, data = null, meta = undefined) {
  return ok(res, data, 201, meta);
}

function noContent(res) {
  return res.status(204).send();
}

module.exports = { ok, created, noContent };
