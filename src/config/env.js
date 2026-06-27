// src/config/env.js — leitura e validação centralizada das variáveis de ambiente.
// Evita process.env espalhado pelo código. Importe SEMPRE daqui.

function required(name) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    // Em produção, falta de variável crítica deve abortar o boot.
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`[env] Variável obrigatória ausente: ${name}`);
    }
    console.warn(`[env] Aviso: variável "${name}" não definida (usando fallback de dev).`);
  }
  return value;
}

function bool(value, fallback = false) {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT || 3000),
  API_PREFIX: process.env.API_PREFIX || '/api/v1',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',

  // Banco
  DATABASE_URL: process.env.DATABASE_URL || null,
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: Number(process.env.DB_PORT || 5432),
  DB_NAME: process.env.DB_NAME || 'app_db',
  DB_USER: process.env.DB_USER || 'postgres',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_SSL: bool(process.env.DB_SSL, false),
  // Cria/ajusta o schema no boot a partir dos models (sem migrations).
  // 'off' | 'create' | 'alter' (padrão) | 'force' (DROPA tudo!).
  DB_SYNC: process.env.DB_SYNC || 'alter',

  // Auth
  JWT_SECRET: required('JWT_SECRET') || 'dev-insecure-secret',
  // Mantido por compatibilidade; a expiração efetiva do access token usa
  // ACCESS_TOKEN_EXPIRES_IN abaixo.
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  ACCESS_TOKEN_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '15m',
  REFRESH_TOKEN_EXPIRES_DAYS: Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS || 30),
  PASSWORD_RESET_EXPIRES_MIN: Number(process.env.PASSWORD_RESET_EXPIRES_MIN || 30),
  // Papéis permitidos no registro público (admin nunca é auto-criável).
  ALLOWED_SELF_REGISTER_ROLES: (process.env.ALLOWED_SELF_REGISTER_ROLES || 'nutritionist,patient')
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean),

  // E-mail (Resend)
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  MAIL_FROM: process.env.MAIL_FROM || 'App <no-reply@example.com>',
  MAIL_REPLY_TO: process.env.MAIL_REPLY_TO || '',
  // URL do front usada para montar links de e-mail (ex: reset de senha).
  APP_WEB_URL: process.env.APP_WEB_URL || 'http://localhost:5173',

  // WebSocket
  WS_CORS_ORIGIN: process.env.WS_CORS_ORIGIN || '*',

  // Pagamentos
  PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER || 'asaas',
  PAYMENT_API_URL: process.env.PAYMENT_API_URL || '',
  PAYMENT_API_KEY: process.env.PAYMENT_API_KEY || '',
  PAYMENT_WEBHOOK_SECRET: process.env.PAYMENT_WEBHOOK_SECRET || '',

  // Push
  FCM_SERVER_KEY: process.env.FCM_SERVER_KEY || '',

  // IA (Anthropic / Claude) — montagem de dieta assistida
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  AI_MODEL: process.env.AI_MODEL || 'claude-opus-4-8',
  AI_MAX_TOKENS: Number(process.env.AI_MAX_TOKENS || 8000),

  // Cache de alimentos populares (em memória)
  FOOD_CACHE_TTL_SECONDS: Number(process.env.FOOD_CACHE_TTL_SECONDS || 300),
  FOOD_POPULAR_LIMIT: Number(process.env.FOOD_POPULAR_LIMIT || 50),

  // Nutricionista padrão criada no boot (se não existir).
  DEFAULT_NUTRI_NAME: process.env.DEFAULT_NUTRI_NAME || 'Nutricionista Beatriz Nascimento',
  DEFAULT_NUTRI_EMAIL: process.env.DEFAULT_NUTRI_EMAIL || '',
  DEFAULT_NUTRI_PASSWORD: process.env.DEFAULT_NUTRI_PASSWORD || '',
};

module.exports = env;
