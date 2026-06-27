# Feature: ShoppingList (Geração e Gestão de Lista)

Traduz a dieta aprovada do paciente em uma lista de suprimentos consolidada,
categorizada por gôndola, com checklist do dia a dia.

## Geração consolidada

`POST /shopping-lists/generate` busca o **plano aprovado** mais recente (ou um
`dietPlanId` específico), percorre `Meals → MealItems` e:
- **Soma quantidades** de itens idênticos por `(alimento|nome + unidade)` — ex:
  50g de aveia no café + 100g no lanche → 150g numa única linha.
- **Categoriza por gôndola** (`categorizer.js`): usa `Food.category` (TACO/TBCA)
  ou palavras-chave do nome. Gôndolas: Hortifruti, Açougue, Laticínios e Ovos,
  Padaria, Bebidas, Mercearia.
- Mantém **uma única lista ativa**: as anteriores viram `archived`.

## Acesso (ownership)

paciente (própria), nutricionista (de seus pacientes), admin (todas).

## Rotas

| Método | Caminho                                         | Descrição |
|--------|-------------------------------------------------|-----------|
| POST   | `/api/v1/shopping-lists/generate`               | Gera lista do plano aprovado (`{ patientProfileId, dietPlanId?, title? }`). |
| GET    | `/api/v1/shopping-lists`                        | Lista (`?patientProfileId=&status=`). |
| GET    | `/api/v1/shopping-lists/:id`                    | Detalhe com itens (ordenados por gôndola). |
| PATCH  | `/api/v1/shopping-lists/:id/status`             | Altera status (`active`/`completed`/`archived`). |
| POST   | `/api/v1/shopping-lists/:id/items`              | Adiciona item manual. |
| PATCH  | `/api/v1/shopping-lists/items/:itemId`          | Edita item. |
| PATCH  | `/api/v1/shopping-lists/items/:itemId/check`    | Marca/desmarca no checklist (`{ isChecked }`). |
| DELETE | `/api/v1/shopping-lists/items/:itemId`          | Remove item. |

## Erros comuns

| Código                      | HTTP | Quando |
|-----------------------------|------|--------|
| `NO_APPROVED_PLAN`          | 404  | Sem plano aprovado para gerar. |
| `EMPTY_PLAN`                | 400  | Plano sem itens. |
| `SHOPPING_LIST_FORBIDDEN`   | 403  | Lista de outro paciente. |
| `SHOPPING_LIST_NOT_FOUND`   | 404  | `:id` inexistente. |
