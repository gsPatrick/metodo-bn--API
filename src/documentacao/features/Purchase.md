# Feature: Purchase (Modo Compra, Gastos e Histórico)

Sessão de compra em tempo real sobre uma `ShoppingList` ativa: checklist + preço,
**alerta de teto de gastos** e persistência do histórico de preços ao finalizar.

## Orçamento (teto de gastos)

Resolução em ordem de prioridade:
1. `ShoppingList.budget` — orçamento da sessão (definido em `POST /purchases/sessions`).
2. `PatientProfile.shoppingBudget` — config padrão do paciente
   (editável via `PATCH /users/profiles/:profileId`).

O resumo da sessão monitora a soma dos preços informados e marca
`budgetExceeded: true` quando o total ultrapassa o orçamento.

## Resumo da sessão (exemplo)
```json
{
  "shoppingListId": "uuid",
  "status": "active",
  "totalItems": 12, "checkedItems": 5, "itemsWithPrice": 5,
  "runningTotal": 87.40,
  "budget": 100.00,
  "budgetExceeded": false,
  "remaining": 12.60
}
```

## Finalização (transação)

`POST /purchases/finalize`:
1. `ShoppingList` → `completed` (`completedAt`).
2. Cria `PurchaseHistory` (total, data, mercado).
3. Cria um `PurchaseItemDetail` por item com preço:
   - `subtotal` = preço informado na linha;
   - `unitPrice` = preço normalizado por quantidade (`preço / quantidade`), base
     do **comparador de preços** entre mercados.

Tudo numa única transação (rollback total em caso de falha).

## Comparador de preços

`GET /purchases/compare/:foodId` agrega `PurchaseItemDetail` por mercado (no
escopo do ator) e devolve `avg/min/max unitPrice` + amostras, ordenado do mais
barato ao mais caro.

## Rotas

| Método | Caminho                                            | Descrição |
|--------|----------------------------------------------------|-----------|
| POST   | `/api/v1/purchases/sessions`                       | Inicia sessão (`{ shoppingListId, budget?, marketId? }`). |
| GET    | `/api/v1/purchases/sessions/:shoppingListId`       | Resumo atual (com alerta). |
| PATCH  | `/api/v1/purchases/sessions/items/:itemId/check`   | Marca item + preço (`{ isChecked?, price? }`) → resumo. |
| POST   | `/api/v1/purchases/finalize`                       | Fecha o carrinho e grava o histórico. |
| GET    | `/api/v1/purchases/history`                        | Histórico (`?patientProfileId=&limit=&offset=`). |
| GET    | `/api/v1/purchases/compare/:foodId`                | Comparador de preços por mercado. |
| GET    | `/api/v1/purchases/:id`                            | Detalhe de uma compra (itens + mercado). |

## Erros comuns

| Código                   | HTTP | Quando |
|--------------------------|------|--------|
| `LIST_ALREADY_COMPLETED` | 400  | Sessão sobre lista já finalizada. |
| `MARKET_NOT_FOUND`       | 404  | `marketId` inexistente na finalização. |
| `PURCHASE_FORBIDDEN`     | 403  | Compra/lista de outro paciente. |
| `PURCHASE_NOT_FOUND`     | 404  | `:id` inexistente. |
