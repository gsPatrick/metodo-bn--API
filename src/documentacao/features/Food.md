# Feature: Food (Catálogo de Alimentos)

Base brasileira TACO/TBCA + alimentos personalizados da nutricionista. Busca
rápida (ILIKE com índice `pg_trgm` GIN), visibilidade por papel e ranking de
populares com cache em memória.

## Carga inicial (seed)

Veja [Foods-Seed.md](./Foods-Seed.md): `npm run migrate && npm run db:seed-foods`
popula ~118 alimentos. O índice `foods_name_trgm_gin` acelera o ILIKE parcial.

## Visibilidade (RBAC)

Aplicada no service (`resolveScopeNutritionistId` + `visibilityWhere`):
- **admin** — todos os alimentos.
- **nutritionist** — públicos (`is_custom = false`) + seus próprios custom.
- **patient** — públicos + custom da **sua** nutricionista.

## Performance — alimentos populares

- `usage_count` (coluna indexada) é incrementado quando o alimento é usado em
  refeições/templates (`food.service.incrementUsage`).
- `GET /foods/popular` serve o ranking do **cache em memória** (TTL
  `FOOD_CACHE_TTL_SECONDS`), por escopo (público / nutricionista). Mudanças em
  `usage_count` ou em alimentos custom invalidam o cache.

## Rotas

| Método | Caminho                  | Acesso                  | Descrição |
|--------|--------------------------|-------------------------|-----------|
| GET    | `/api/v1/foods`          | autenticado             | Busca (`?q=&category=&source=&limit=&offset=`); `meta.total`. Ordena por `usage_count`. |
| GET    | `/api/v1/foods/popular`  | autenticado             | Ranking de mais usados (cacheado). |
| GET    | `/api/v1/foods/:id`      | autenticado             | Detalhe (respeita visibilidade). |
| POST   | `/api/v1/foods`          | `nutritionist`, `admin` | Cria alimento custom. |
| PATCH  | `/api/v1/foods/:id`      | `nutritionist`, `admin` | Atualiza alimento custom próprio. |
| DELETE | `/api/v1/foods/:id`      | `nutritionist`, `admin` | Remove alimento custom próprio. |

## Payloads

### POST /foods (alimento custom, macros por 100g)
```json
{
  "name": "Whey isolado (baunilha)",
  "category": "Suplementos",
  "kcal": 380, "carbsG": 8, "proteinG": 80, "fatG": 3, "fiberG": 0, "sodiumMg": 250
}
```

## Erros comuns

| Código             | HTTP | Quando |
|--------------------|------|--------|
| `MISSING_FIELDS`   | 400  | `name` ausente. |
| `FOOD_NOT_FOUND`   | 404  | Inexistente ou fora da visibilidade. |
| `FOOD_FORBIDDEN`   | 403  | Editar custom de outra nutricionista. |
| `NOT_NUTRITIONIST` | 403  | Criar alimento sem ser nutri/admin. |
