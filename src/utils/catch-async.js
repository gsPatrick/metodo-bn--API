// src/utils/catch-async.js — wrapper para handlers async.
// Captura rejeições de Promises e encaminha ao error handler via next(),
// evitando try/catch repetitivo em cada controller.
module.exports = function catchAsync(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};
