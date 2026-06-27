# Modelos — visão geral

Todas as entidades usam **UUID** como PK, `underscored: true` (snake_case no DB,
camelCase no código) e timestamps `created_at`/`updated_at`. FKs com
`ON DELETE CASCADE` onde a entidade filha não faz sentido sem o pai, e
`ON DELETE SET NULL` em referências opcionais (ex: catálogo de alimentos).

## RBAC / Identidade
- **User** — credenciais, `role` ENUM(`admin`,`nutritionist`,`patient`), `is_active`.
- **PatientProfile** — 1:1 com User (paciente); antropometria, objetivo; FK obrigatória `nutritionist_id` → User.
- **PatientRestriction** — N:1 com PatientProfile; alergia/intolerância/preferência.

## Sessão / Auth
- **RefreshToken** — N:1 User; `token_hash` (SHA-256), `expires_at`, `revoked_at`, `replaced_by_token_hash` (rotação/detecção de reuso).
- **PasswordResetToken** — N:1 User; `token_hash`, `expires_at`, `used_at` (uso único).

## Notificações & WebSocket
- **Notification** — N:1 User; `type` ENUM, `is_read`, `metadata` JSONB.
- **DeviceToken** — N:1 User; token FCM/APNS, `platform` ENUM.
- **WebSocketConnection** — N:1 User; `socket_id` para presença/envio direcionado.

## Dieta (Fase A)
- **Food** — catálogo TACO/TBCA, macros por 100g; `is_custom` + `created_by_nutritionist_id`; `usage_count` (indexado, ranking de populares); índice `pg_trgm` GIN em `name` para ILIKE.
- **DietPlan** — N:1 PatientProfile; metas macro; `status` ENUM(`draft`,`approved`).
- **Meal** — N:1 DietPlan; ordenação + horário.
- **MealItem** — N:1 Meal; FK opcional Food ou `custom_food_name` (fallback).
- **MealTemplate** — N:1 User(nutricionista); pratos reutilizáveis; macros totais pré-computados; `usage_count`.
- **MealTemplateItem** — N:1 MealTemplate; FK opcional Food ou `custom_food_name`.

## Compras & Geo (Fase B)
- **ShoppingList** — N:1 PatientProfile; `status` ENUM; `budget` (orçamento da sessão).
- **ShoppingListItem** — N:1 ShoppingList; `is_checked`, `price` (Modo Compra).
- **Market** — geolocalização `latitude`/`longitude` DECIMAL(10,7), índice composto; busca por Haversine.
- **PurchaseHistory** — N:1 PatientProfile/Market; `total_amount`, `purchased_at`.
- **PurchaseItemDetail** — N:1 PurchaseHistory; `unit_price` normalizado (comparador de preços).

> `PatientProfile.shopping_budget` é o teto de gastos padrão do paciente (config).

## Monetização (Fase C)
- **MonetizationConfig** — global (FK nula) ou por nutricionista; `is_enabled`.
- **PaymentPlan** — N:1 User(nutricionista); `price`, `cycle_days`.
- **Subscription** — N:1 PatientProfile/PaymentPlan; `status` ENUM; IDs de gateway.
- **PaymentTransaction** — N:1 Subscription; `method`/`status` ENUM; `gateway_payload` JSONB.

## Lifestyle (Fase D)
- **DailyHealthMetric** — N:1 PatientProfile; sono/passos/água/estresse/adesão + `calculated_health_score`. Único por (paciente, dia).

## Anamnese / Prontuário (regra de ouro)
- **Anamnesis** — 1:1 PatientProfile; blocos JSONB do formulário + `allergies`/`intolerances`/`aversions`/`preferences` (restrições estruturadas).
- **AnthropometricAssessment** — N:1 PatientProfile; peso/altura/IMC/%MG, circunferências/dobras (JSONB). Fonte autoritativa de peso/altura para o TDEE.
- **BiochemicalExam** — N:1 PatientProfile; painel por data (resultados JSONB).
- **NutritionalEvolution** — N:1 PatientProfile; notas de evolução datadas.

## Diagrama textual de dependências

```
User ─┬─< RefreshToken
      ├─< PasswordResetToken
      ├─< PatientProfile ─┬─< PatientRestriction
      │                    ├─< DietPlan ─< Meal ─< MealItem >─ Food
      │                    ├─< ShoppingList ─< ShoppingListItem >─ Food
      │                    ├─< PurchaseHistory ─< PurchaseItemDetail >─ Food
      │                    │        └─> Market
      │                    ├─< Subscription ─< PaymentTransaction
      │                    └─< DailyHealthMetric
      ├─< Notification
      ├─< DeviceToken
      ├─< WebSocketConnection
      ├─< Food (custom)
      ├─< PaymentPlan ─< Subscription
      └─1 MonetizationConfig
```
