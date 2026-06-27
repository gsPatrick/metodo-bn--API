# Feature: Notification (Notificações e Tempo Real)

Centraliza o envio de alertas **persistidos** no banco e os **disparos de eventos
WebSocket** via Socket.io. O service `notify()` é o ponto único de envio — outras
features (auth, dieta, pagamentos…) chamam-no em vez de tocar no model diretamente.

## Rotas HTTP

| Método | Caminho                              | Acesso                  | Descrição |
|--------|--------------------------------------|-------------------------|-----------|
| GET    | `/api/v1/notifications`              | autenticado             | Lista do próprio usuário (`?unread=true&limit=&offset=`); `meta.total`. |
| GET    | `/api/v1/notifications/unread-count` | autenticado             | Contagem de não lidas. |
| PATCH  | `/api/v1/notifications/read-all`     | autenticado             | Marca todas como lidas. |
| PATCH  | `/api/v1/notifications/:id/read`     | autenticado             | Marca uma como lida. |
| DELETE | `/api/v1/notifications/:id`          | autenticado             | Remove uma notificação. |
| POST   | `/api/v1/notifications`              | `admin`, `nutritionist` | Envia notificação manual para um usuário. |

## WebSocket (Socket.io)

- Conexão: `io(URL, { auth: { token: <accessToken> } })` — handshake valida o JWT.
- Cada usuário entra na room `user:<id>` (envio direcionado).
- Eventos emitidos ao destinatário:

| Evento                        | Payload                         | Quando |
|-------------------------------|---------------------------------|--------|
| `notification:new`            | objeto da notificação           | Nova notificação criada. |
| `notification:unread_count`   | `{ count }`                     | Após criar/ler/apagar. |

## Tipos (`type`)

`diet_approved` · `budget_warning` · `payment_success` · `payment_failed` ·
`new_message` · `system_alert` (fallback se tipo inválido/omitido).

## Uso programático (em outros services)

```js
const notificationService = require('../notification/notification.service');

// Um destinatário:
await notificationService.notify({
  userId: patientUserId,
  title: 'Dieta liberada',
  message: 'Sua nutricionista aprovou seu novo plano.',
  type: 'diet_approved',
  metadata: { dietPlanId },   // deep-link no app
});

// Vários destinatários:
await notificationService.notifyMany([id1, id2], {
  title: 'Aviso',
  message: 'Manutenção programada.',
  type: 'system_alert',
});
```

### POST /notifications (envio manual)
```json
{
  "userId": "uuid-do-destinatario",
  "title": "Lembrete",
  "message": "Não esqueça de registrar suas métricas hoje.",
  "type": "system_alert",
  "metadata": { "screen": "daily_metrics" }
}
```

## Erros comuns

| Código                   | HTTP | Quando |
|--------------------------|------|--------|
| `MISSING_FIELDS`         | 400  | `userId`/`title`/`message` ausentes. |
| `USER_NOT_FOUND`         | 404  | Destinatário inexistente (envio manual). |
| `NOTIFICATION_NOT_FOUND` | 404  | `:id` não pertence ao usuário. |
