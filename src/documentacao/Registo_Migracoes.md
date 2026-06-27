# Registo de Migrações (changelog de schema)

Anote aqui, em ordem cronológica, cada mudança relevante de schema.

| Data       | Mudança                                              | Migration |
|------------|------------------------------------------------------|-----------|
| 2026-06-23 | Modelagem inicial (RBAC, notificações/WS, dieta, compras/geo, monetização, health score) — 20 tabelas, ENUMs, índices e FKs. | `20260623000000-initial-schema.js` |
| 2026-06-23 | Tabelas de sessão/auth: `refresh_tokens` e `password_reset_tokens` (suporte a refresh com rotação e recuperação de senha). | `20260623010000-auth-tokens.js` |
| 2026-06-23 | `foods.usage_count` (ranking de populares) + `meal_templates`/`meal_template_items` (modelos de refeição). | `20260623020000-meal-templates-and-food-usage.js` |
| 2026-06-23 | Extensão `pg_trgm` + índice GIN `foods_name_trgm_gin` em `foods.name` (busca ILIKE rápida na digitação). | `20260623030000-foods-search-index.js` |
| 2026-06-23 | Orçamento do Modo Compra: `patient_profiles.shopping_budget` (config) e `shopping_lists.budget` (sessão). | `20260623040000-shopping-budget.js` |
| 2026-06-24 | Anamnese e prontuário: `anamneses`, `anthropometric_assessments`, `biochemical_exams`, `nutritional_evolutions` (regra de ouro p/ cálculos e IA). | `20260624000000-anamnesis.js` |
| 2026-06-25 | Reforços: `anamneses.clinical_conditions` (regras por patologia) e `patient_restrictions.source` (sync de restrições da anamnese). | `20260625000000-anamnesis-enhancements.js` |

## Notas da migration inicial

- Cria as 20 tabelas em **ordem estrita de dependência das FKs**, tudo numa única
  transação (rollback total em caso de falha).
- Habilita a extensão `pgcrypto` e usa `gen_random_uuid()` como default das PKs UUID.
- `ON DELETE CASCADE` em vínculos obrigatórios; `ON DELETE SET NULL` em referências
  opcionais (ex: `food_id`, `market_id`, `diet_plan_id` em listas/compras).
- `down` faz drop na ordem inversa e remove os tipos ENUM (`enum_*`) para permitir
  re-execução limpa.

```bash
npm run migrate        # aplica a migration inicial
npm run migrate:undo   # reverte (drop completo do schema)
```
