# Middlewares transversais

| Middleware                    | Arquivo                            | Função |
|-------------------------------|------------------------------------|--------|
| `authenticate`                | `auth.middleware.js`               | Valida Bearer JWT, carrega `req.user`/`req.auth`. |
| `authorize(...roles)`         | `auth.middleware.js`               | RBAC: restringe a rota aos papéis informados. |
| `requireActiveSubscription`   | `subscription.middleware.js`       | Gate de monetização: bloqueia paciente sem assinatura ativa (no-op p/ nutri/admin). |
| `errorHandler`                | `error.middleware.js`              | Handler global: normaliza erros Sequelize → `AppError`, resposta padronizada. |
| `notFoundHandler`             | `not-found.middleware.js`          | 404 para rotas não registradas. |

## Contrato de resposta

- Sucesso: `{ success: true, data, meta? }` (via `utils/http-response.js`).
- Erro: `{ success: false, error: { code, message, details? } }`.

`code` é um identificador textual **estável** (ex: `USER_NOT_FOUND`) — o cliente
deve reagir a ele, não à `message`.
