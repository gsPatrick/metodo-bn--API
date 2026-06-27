# Documentação da API — comece aqui

API em **Node.js + Express + Sequelize + PostgreSQL** com RBAC (3 papéis),
WebSockets (Socket.io), sistema de notificações e monetização liga/desliga.

## Índice

- [ONBOARDING.md](./ONBOARDING.md) — rodar local, migrar DB, primeiro usuário, logs.
- [ENV_REFERENCE.md](./ENV_REFERENCE.md) — todas as variáveis de ambiente.
- [Registo_Migracoes.md](./Registo_Migracoes.md) — changelog curto de schema.
- **Features**
  - [features/Auth.md](./features/Auth.md)
  - [features/User.md](./features/User.md)
  - [features/Notification.md](./features/Notification.md)
  - [features/Food.md](./features/Food.md)
  - [features/DietPlan.md](./features/DietPlan.md)
  - [features/Foods-Seed.md](./features/Foods-Seed.md) — carga TACO/TBCA
  - [features/ShoppingList.md](./features/ShoppingList.md)
  - [features/Market.md](./features/Market.md)
  - [features/Purchase.md](./features/Purchase.md)
  - [features/Monetization.md](./features/Monetization.md)
  - [features/Billing.md](./features/Billing.md)
  - [features/HealthMetric.md](./features/HealthMetric.md)
  - [features/Anamnesis.md](./features/Anamnesis.md) — prontuário + regra de ouro
- **Modelos**
  - [models/Overview.md](./models/Overview.md) — mapa de entidades e relacionamentos.

## Arquitetura em uma frase

Cada pedido HTTP segue **routes → controller → service** (e → provider quando há
sistema externo). Controllers só fazem HTTP; toda regra de negócio vive em
services; integrações externas ficam em `src/providers/`.

## Estrutura

```
app.js                      # entrada: Express, Socket.io, mounts, erro global
src/
  config/                   # env, database, constants
  models/                   # 1 ficheiro por entidade + index.js (associações)
  features/<nome>/          # <nome>.routes|controller|service.js
  routes/index.js           # agregador único das rotas da versão
  middlewares/              # auth, erro, 404
  providers/                # websocket, payment-gateway
  documentacao/             # esta pasta
migrations/                 # schema versionado (sequelize-cli)
scripts/                    # db-sync, smoke-test
```
