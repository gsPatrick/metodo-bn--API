// app.js — ponto de entrada da aplicação.
// Responsabilidade única: carregar env, instanciar Express, middlewares globais,
// montar rotas, registrar handler de erro e iniciar o servidor (HTTP + WebSocket).
require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const env = require('./src/config/env');
const routes = require('./src/routes');
const errorHandler = require('./src/middlewares/error.middleware');
const notFoundHandler = require('./src/middlewares/not-found.middleware');
const { initSocket } = require('./src/providers/websocket/socket-server');
const { sequelize } = require('./src/models');
const { ensureDefaultNutritionist } = require('./src/bootstrap/ensure-default-user');
const { ensureFoodCatalog } = require('./src/bootstrap/ensure-food-catalog');

const app = express();

// --- Middlewares globais ---
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '15mb' })); // anexos de chat (imagem/áudio/doc em base64)
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// --- Montagem das rotas versionadas (prefixo configurável) ---
app.use(env.API_PREFIX, routes);

// --- 404 e handler de erro global (sempre por último) ---
app.use(notFoundHandler);
app.use(errorHandler);

// --- Servidor HTTP + Socket.io ---
const server = http.createServer(app);
initSocket(server);

async function bootstrap() {
  try {
    await sequelize.authenticate();
    console.log('[db] Conexão com PostgreSQL estabelecida.');

    // Cria/ajusta o schema automaticamente a partir dos models (sem migrations).
    // DB_SYNC: 'off' | 'create' | 'alter' (padrão) | 'force' (DROPA tudo!).
    if (env.DB_SYNC && env.DB_SYNC !== 'off') {
      await sequelize.sync({ alter: env.DB_SYNC === 'alter', force: env.DB_SYNC === 'force' });
      console.log(`[db] Schema sincronizado (DB_SYNC=${env.DB_SYNC}).`);
    }

    // Garante a nutricionista padrão (idempotente). Não derruba o boot se falhar.
    await ensureDefaultNutritionist().catch((e) => console.error('[seed] Falha ao criar nutri padrão:', e.message));

    // Bind explícito em 0.0.0.0 para aceitar conexões do proxy (EasyPanel/Docker).
    server.listen(env.PORT, '0.0.0.0', () => {
      console.log(`[http] API ouvindo em 0.0.0.0:${env.PORT}${env.API_PREFIX} (NODE_ENV=${env.NODE_ENV})`);
    });

    // Catálogo de alimentos (TACO/TBCA + medidas caseiras) em background, sem
    // bloquear o boot/healthcheck (o backfill de medidas pode demorar).
    ensureFoodCatalog().catch((e) => console.error('[seed] Falha ao semear alimentos:', e.message));
  } catch (err) {
    console.error('[boot] Falha ao iniciar a aplicação:', err);
    process.exit(1);
  }
}

// Só faz bootstrap se executado diretamente (permite importar app em testes).
if (require.main === module) {
  bootstrap();
}

module.exports = { app, server, bootstrap };
