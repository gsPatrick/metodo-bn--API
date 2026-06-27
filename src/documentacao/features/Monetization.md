# Feature: Monetization (Liga/Desliga)

Controla, por nutricionista, se os pacientes precisam de **assinatura ativa** para
acessar plano alimentar e lista de compras.

## Regra liga/desliga

`MonetizationConfig.isEnabled` por nutricionista (com fallback para config global
`nutritionist_id = null`):
- **`false` / sem config** → pacientes acessam tudo **gratuitamente**.
- **`true`** → o paciente precisa de uma `Subscription` com status `active` e
  vigente (`currentPeriodEnd` futuro ou nulo). Sem isso, o acesso é bloqueado.

## Gate de acesso (middleware)

`middlewares/subscription.middleware.js → requireActiveSubscription`:
- Aplicado nos routers de **diet-plan** e **shopping-list**.
- **Só afeta pacientes.** Nutri/admin passam direto (no-op).
- Paciente sem assinatura (com monetização ligada) → `403 SUBSCRIPTION_REQUIRED`.

A decisão usa `monetization.service.checkPatientAccess(userId)`, que devolve
`{ allowed, reason, monetizationEnabled, hasSubscription }`.

## Rotas

| Método | Caminho                         | Acesso                  | Descrição |
|--------|---------------------------------|-------------------------|-----------|
| GET    | `/api/v1/monetization/config`   | `nutritionist`, `admin` | Lê a config (admin pode `?nutritionistId=`). |
| PUT    | `/api/v1/monetization/config`   | `nutritionist`, `admin` | Liga/desliga (`{ isEnabled, gatewayAccountId?, notes? }`). |
| GET    | `/api/v1/monetization/access`   | autenticado             | Status de acesso do paciente (paywall do app). |

## Erros comuns

| Código                  | HTTP | Quando |
|-------------------------|------|--------|
| `SUBSCRIPTION_REQUIRED` | 403  | Paciente sem assinatura ativa em recurso protegido. |
| `NOT_ALLOWED`           | 403  | Paciente tentando configurar monetização. |
