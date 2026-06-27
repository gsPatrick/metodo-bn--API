# Referência de variáveis de ambiente

Atualize este arquivo **e** `.env.example` sempre que surgir nova variável.
Valores nos exemplos são ilustrativos — nunca commitar segredos reais.

## Aplicação

| Variável     | Obrigatória | Padrão        | Descrição |
|--------------|-------------|---------------|-----------|
| `NODE_ENV`   | não         | `development` | `development` \| `production` \| `test`. |
| `PORT`       | não         | `3000`        | Porta HTTP. |
| `API_PREFIX` | não         | `/api/v1`     | Prefixo das rotas versionadas. |
| `CORS_ORIGIN`| não         | `*`           | Origem permitida para CORS HTTP. |

## Banco de dados (PostgreSQL)

| Variável       | Obrigatória | Padrão      | Descrição |
|----------------|-------------|-------------|-----------|
| `DATABASE_URL` | não         | —           | URL única; tem prioridade sobre `DB_*`. |
| `DB_HOST`      | sim*        | `localhost` | Host do Postgres. |
| `DB_PORT`      | não         | `5432`      | Porta. |
| `DB_NAME`      | sim*        | `app_db`    | Nome do banco. |
| `DB_USER`      | sim*        | `postgres`  | Usuário. |
| `DB_PASSWORD`  | sim*        | —           | Senha. |
| `DB_SSL`       | não         | `false`     | `true` para conexões SSL (cloud). |

\* obrigatórias se `DATABASE_URL` não for usada.

## Autenticação (JWT + Refresh + Reset)

| Variável                     | Obrigatória | Padrão           | Descrição |
|------------------------------|-------------|------------------|-----------|
| `JWT_SECRET`                 | **sim**     | —                | Segredo de assinatura do access token. Aborta o boot em produção se ausente. |
| `JWT_ACCESS_EXPIRES_IN`      | não         | `15m`            | Validade do access token (curto). |
| `REFRESH_TOKEN_EXPIRES_DAYS` | não         | `30`             | Validade do refresh token (dias). |
| `PASSWORD_RESET_EXPIRES_MIN` | não         | `30`             | Validade do token de recuperação de senha (minutos). |
| `ALLOWED_SELF_REGISTER_ROLES`| não         | `nutritionist,patient` | Papéis aceitos no registro público. `admin` nunca é auto-criável. |

## E-mail (Resend)

| Variável        | Obrigatória | Padrão                       | Descrição |
|-----------------|-------------|------------------------------|-----------|
| `RESEND_API_KEY`| cond.       | —                            | Chave da API Resend. Sem ela, envios viram no-op logado (dev). |
| `MAIL_FROM`     | não         | `App <no-reply@example.com>` | Remetente dos e-mails transacionais. |
| `MAIL_REPLY_TO` | não         | —                            | Reply-To opcional. |
| `APP_WEB_URL`   | não         | `http://localhost:5173`      | Base do front para montar links (ex: reset de senha). |

## WebSocket (Socket.io)

| Variável         | Obrigatória | Padrão | Descrição |
|------------------|-------------|--------|-----------|
| `WS_CORS_ORIGIN` | não         | `*`    | Origem permitida no handshake do socket. |

## Gateway de pagamento

| Variável                 | Obrigatória | Padrão | Descrição |
|--------------------------|-------------|--------|-----------|
| `PAYMENT_PROVIDER`       | não         | `asaas`| `asaas` \| `stripe` \| `pagarme`. |
| `PAYMENT_API_URL`        | cond.       | —      | Base URL do gateway. Obrigatória se monetização ligada. |
| `PAYMENT_API_KEY`        | cond.       | —      | Chave de API do gateway. |
| `PAYMENT_WEBHOOK_SECRET` | cond.       | —      | Segredo p/ validar webhooks. |

## Push notifications

| Variável         | Obrigatória | Padrão | Descrição |
|------------------|-------------|--------|-----------|
| `FCM_SERVER_KEY` | não         | —      | Chave do FCM para push nativo. |

## IA (Anthropic / Claude) — montagem assistida de dieta

| Variável            | Obrigatória | Padrão            | Descrição |
|---------------------|-------------|-------------------|-----------|
| `ANTHROPIC_API_KEY` | cond.       | —                 | Chave da API Anthropic. Sem ela, a rota `POST /diet-plans/ai` retorna `AI_NOT_CONFIGURED`. |
| `AI_MODEL`          | não         | `claude-opus-4-8` | Modelo Claude usado na geração. |
| `AI_MAX_TOKENS`     | não         | `8000`            | Limite de tokens de saída da geração. |

## Catálogo de alimentos (cache)

| Variável                 | Obrigatória | Padrão | Descrição |
|--------------------------|-------------|--------|-----------|
| `FOOD_CACHE_TTL_SECONDS` | não         | `300`  | TTL do cache em memória dos alimentos populares. |
| `FOOD_POPULAR_LIMIT`     | não         | `50`   | Quantidade de itens no ranking de populares. |
