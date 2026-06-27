# Feature: Billing (Planos, Assinaturas e Gateway Asaas)

Planos de cobrança da nutricionista, criação de assinatura com cobrança Pix/boleto
via **Asaas** e webhook que ativa a assinatura ao confirmar o pagamento.

## Provider Asaas

`src/providers/payment-gateway/asaas-client.js` (foco BR — Pix e boleto):
- `createCustomer`, `createSubscription` (recorrente), `createPayment` (1ª cobrança),
  `getPixQrCode` (copia-e-cola), `cancelSubscription`, `validateWebhookToken`.
- Erros viram `GatewayError` → mapeados para `502 PAYMENT_GATEWAY_ERROR` no handler global.
- Config via env: `PAYMENT_API_URL`, `PAYMENT_API_KEY`, `PAYMENT_WEBHOOK_SECRET`
  (ver [ENV_REFERENCE](../ENV_REFERENCE.md)). Sem chaves → `503`.

## Fluxo de assinatura

`POST /billing/subscriptions`:
1. Garante o cliente no Asaas (reaproveita o `gatewayCustomerId` de assinaturas anteriores).
2. Cria a **assinatura recorrente** (próxima cobrança após o ciclo) e a **1ª cobrança** Pix imediata.
3. Persiste `Subscription` com status `past_due` (aguardando pagamento) e
   `PaymentTransaction` `pending`.
4. Retorna `{ subscription, transaction, pix: { payload, encodedImage, expirationDate } }`.

> O status `past_due` representa "aguardando 1º pagamento"; o webhook o promove a `active`.

## Webhook (público)

`POST /billing/webhook` — valida o token do Asaas (`asaas-access-token`), localiza a
transação por `gatewayTransactionId` (ou cria a partir da assinatura para cobranças
recorrentes) e:
- `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED` → transação confirmada/recebida +
  `Subscription` → `active`, estende `currentPeriodEnd` em `cycleDays`; notifica
  o paciente (`payment_success`).
- `PAYMENT_OVERDUE`/`PAYMENT_DELETED`/chargeback → transação `failed`,
  `Subscription` → `past_due`; notifica (`payment_failed`).
- Idempotente por `gatewayTransactionId` (retries do Asaas são seguros).

## Rotas

| Método | Caminho                                      | Acesso                  | Descrição |
|--------|----------------------------------------------|-------------------------|-----------|
| POST   | `/api/v1/billing/webhook`                    | **público** (token)     | Notificações do Asaas. |
| GET    | `/api/v1/billing/plans`                      | autenticado             | Planos (paciente vê os da sua nutri). |
| POST   | `/api/v1/billing/plans`                      | `nutritionist`, `admin` | Cria plano (`{ name, price, cycleDays }`). |
| PATCH  | `/api/v1/billing/plans/:id`                  | `nutritionist`, `admin` | Edita plano. |
| DELETE | `/api/v1/billing/plans/:id`                  | `nutritionist`, `admin` | Remove plano. |
| POST   | `/api/v1/billing/subscriptions`              | paciente/nutri/admin    | Assina (`{ patientProfileId, paymentPlanId, cpfCnpj?, billingType? }`). |
| GET    | `/api/v1/billing/subscriptions`              | autenticado             | Lista assinaturas (escopo do ator). |
| GET    | `/api/v1/billing/subscriptions/:id`          | ownership               | Detalhe + plano + transações. |
| POST   | `/api/v1/billing/subscriptions/:id/cancel`   | ownership               | Cancela (local + gateway). |

## Erros comuns

| Código                  | HTTP | Quando |
|-------------------------|------|--------|
| `PAYMENT_GATEWAY_ERROR` | 502  | Falha na comunicação com o Asaas. |
| `PLAN_MISMATCH`         | 400  | Plano não é da nutricionista do paciente. |
| `WEBHOOK_INVALID`       | 401  | Token do webhook incorreto. |
| `BILLING_FORBIDDEN`     | 403  | Assinatura de outro paciente. |
