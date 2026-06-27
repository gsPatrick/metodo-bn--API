# Feature: DietPlan (Prescrição, Cálculo e IA)

Cálculo de metas (TDEE/macros), fluxo `draft → approved` com notificação ao
paciente, refeições dinâmicas, modelos de refeição (meal templates) e montagem
manual **ou** assistida por IA.

## Cálculo nutricional

`nutrition-calculator.js` — BMR por **Mifflin-St Jeor** × fator de atividade =
TDEE; ajuste calórico e split de macros conforme o objetivo:

| Objetivo (`goal`) | kcal | Proteína | Carbo | Gordura |
|-------------------|------|----------|-------|---------|
| `lose_weight`     | 0,8× TDEE | 35% | 40% | 25% |
| `maintain`        | 1,0× TDEE | 30% | 45% | 25% |
| `gain_muscle`     | 1,1× TDEE | 30% | 50% | 20% |

`GET /diet-plans/targets/:patientProfileId` devolve o cálculo (preview) sem criar plano.

> **Regra de ouro (Anamnese):** o cálculo usa o **peso/altura da avaliação
> antropométrica mais recente** (cai no `PatientProfile` se não houver). A geração
> por IA recebe alergias/intolerâncias/aversões e patologias da anamnese como
> restrições/orientações obrigatórias. Ver [Anamnesis.md](./Anamnesis.md).

## Fluxo draft → approved

- Plano nasce `draft` (visível só para nutri/admin).
- `POST /:id/approve` → `approved` + `approvedAt`; o **paciente é notificado** via
  `notification.service.notify` (persiste + evento WebSocket `notification:new`,
  tipo `diet_approved`). Planos aprovados ficam imutáveis (`PLAN_APPROVED_IMMUTABLE`).
- Paciente só enxerga planos **aprovados** do próprio perfil.

## Modelos de refeição (performance)

Combinações frequentes ("Arroz, Feijão, Frango e Salada") são salvas como
`MealTemplate` com **macros totais pré-computados** e itens carregados em **lote**
(`include`), evitando dezenas de consultas. `POST /:id/meals/from-template` insere
o prato inteiro de uma vez e incrementa `usage_count` (template e alimentos).

## Montagem manual vs IA

- **Manual:** `POST /:id/meals`, `POST /meals/:mealId/items`, etc.
- **IA (`POST /diet-plans/ai`):** envia perfil + restrições + metas + candidatos do
  catálogo ao provedor Claude (`src/providers/ai`, **tool use** com saída
  estruturada). A resposta é mapeada para `Meals`/`MealItems`, casando os nomes
  sugeridos com alimentos reais do catálogo (match por similaridade; fallback em
  texto livre). Gera um rascunho `draft` válido para a nutricionista revisar e aprovar.

## Rotas

| Método | Caminho                                    | Acesso        | Descrição |
|--------|--------------------------------------------|---------------|-----------|
| GET    | `/api/v1/diet-plans/targets/:patientProfileId` | `nutri/admin` | Preview de metas (TDEE/macros). |
| GET    | `/api/v1/diet-plans/templates`             | `nutri/admin` | Lista modelos de refeição. |
| POST   | `/api/v1/diet-plans/templates`             | `nutri/admin` | Cria modelo (totais pré-computados). |
| GET    | `/api/v1/diet-plans/templates/:templateId` | `nutri/admin` | Detalhe do modelo. |
| DELETE | `/api/v1/diet-plans/templates/:templateId` | `nutri/admin` | Remove modelo. |
| POST   | `/api/v1/diet-plans/ai`                     | `nutri/admin` | Gera rascunho via IA. |
| GET    | `/api/v1/diet-plans`                        | autenticado   | Lista (paciente vê só aprovados). |
| POST   | `/api/v1/diet-plans`                        | `nutri/admin` | Cria plano `draft`. |
| GET    | `/api/v1/diet-plans/:id`                    | ownership     | Detalhe (refeições + itens + alimentos) **+ `nutrition`** (totais + aderência). |
| GET    | `/api/v1/diet-plans/:id/summary`            | ownership     | Totais nutricionais por refeição/plano + aderência à meta. |
| PATCH  | `/api/v1/diet-plans/:id`                    | `nutri/admin` | Atualiza (não aprovado). |
| DELETE | `/api/v1/diet-plans/:id`                    | `nutri/admin` | Remove. |
| POST   | `/api/v1/diet-plans/:id/approve`            | `nutri/admin` | Aprova e notifica o paciente. |
| POST   | `/api/v1/diet-plans/:id/meals`             | `nutri/admin` | Adiciona refeição. |
| POST   | `/api/v1/diet-plans/:id/meals/from-template`| `nutri/admin` | Adiciona refeição a partir de modelo. |
| PATCH  | `/api/v1/diet-plans/meals/:mealId`         | `nutri/admin` | Edita refeição (nome/horário/ordem/notas). |
| DELETE | `/api/v1/diet-plans/meals/:mealId`         | `nutri/admin` | Remove refeição. |
| POST   | `/api/v1/diet-plans/meals/:mealId/items`   | `nutri/admin` | Adiciona item à refeição. |
| PATCH  | `/api/v1/diet-plans/items/:itemId`         | `nutri/admin` | Edita item (alimento/quantidade/unidade/notas). |
| DELETE | `/api/v1/diet-plans/items/:itemId`         | `nutri/admin` | Remove item. |

## Totais nutricionais & aderência

`GET /diet-plans/:id` e `/:id/summary` retornam o que o plano **realmente entrega**
(somando `MealItem × Food` por 100g) por refeição e total, com a aderência às metas:
```json
"nutrition": {
  "totals": { "kcal": 1980, "carbsG": 210, "proteinG": 150, "fatG": 62, "fiberG": 28, "sodiumMg": 1800 },
  "meals": [ { "mealId": "...", "name": "Almoço", "itemCount": 4, "totals": { "kcal": 620, ... } } ],
  "totalItems": 18,
  "uncomputedItems": 2,
  "adherence": { "kcal": { "target": 2000, "actual": 1980, "percent": 99, "diff": -20 }, "proteinG": { ... } }
}
```
> Itens em unidades caseiras (ex.: "1 unidade", "1 fatia") não têm conversão segura
> para macros e são contados em `uncomputedItems` (não entram no total). Itens em
> `g`/`ml` são proporcionais (`quantidade/100 × valor por 100g`).

## Payloads

### POST /diet-plans
```json
{ "patientProfileId": "uuid", "title": "Plano de cutting" }
```
> Se `targets` não for enviado, é calculado a partir do `PatientProfile`.

### POST /diet-plans/ai
```json
{ "patientProfileId": "uuid", "instruction": "Dieta de 2000 kcal sem derivados do leite" }
```

### POST /diet-plans/templates
```json
{
  "name": "Almoço básico",
  "preferredTime": "12:30",
  "items": [
    { "foodId": "uuid-arroz", "quantity": 120, "unit": "g" },
    { "foodId": "uuid-feijao", "quantity": 80, "unit": "g" },
    { "customFoodName": "Frango grelhado", "quantity": 150, "unit": "g" }
  ]
}
```

## Erros comuns

| Código                    | HTTP | Quando |
|---------------------------|------|--------|
| `PROFILE_NOT_FOUND`       | 404  | `patientProfileId` inexistente. |
| `PATIENT_FORBIDDEN`       | 403  | Paciente não pertence à nutricionista. |
| `DIET_PLAN_FORBIDDEN`     | 403  | Sem acesso ao plano (ou draft p/ paciente). |
| `PLAN_APPROVED_IMMUTABLE` | 400  | Editar plano já aprovado. |
| `PATIENT_READONLY`        | 403  | Paciente tentando editar. |
| `AI_NOT_CONFIGURED`       | 400  | `ANTHROPIC_API_KEY` ausente. |
| `AI_REQUEST_FAILED`/`AI_BAD_OUTPUT` | 400 | Falha/saída inválida da IA. |
