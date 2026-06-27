# Onboarding

## Pré-requisitos

- Node.js >= 18 (usa `fetch` global no provider de pagamento)
- PostgreSQL >= 13

## 1. Instalar e configurar

```bash
cd api
npm install
cp .env.example .env       # preencha DB_*, JWT_SECRET, etc.
```

## 2. Criar o banco

```bash
createdb app_db            # ou via cliente de sua preferência
```

## 3. Criar o schema

```bash
# Desenvolvimento (rápido, a partir dos models):
npm run db:sync

# Produção / versionado:
npm run migrate
```

## 4. Rodar a API

```bash
npm run dev     # com --watch
# ou
npm start
```

A API sobe em `http://localhost:3000/api/v1` (prefixo configurável via `API_PREFIX`).
Health check: `GET /api/v1/health`.

## 5. Criar o primeiro usuário (admin)

Ainda não há rota pública de signup de admin (criação é restrita). Crie via REPL:

```bash
node -e "require('dotenv').config(); const db=require('./src/models'); (async()=>{ \
  const u = db.User.build({ name:'Admin', email:'admin@local', role:'admin' }); \
  await u.setPassword('senha123'); await u.save(); \
  console.log('admin criado:', u.id); process.exit(0); })()"
```

Depois faça login:

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@local","password":"senha123"}'
```

## Logs

- HTTP: `morgan` no stdout (`dev` em desenvolvimento, `combined` em produção).
- SQL: ativado no stdout quando `NODE_ENV=development`.
- Erros 5xx: `console.error('[error]', ...)` no handler global.

## Smoke test

```bash
npm run smoke:test   # confere conexão e carregamento dos models
```
