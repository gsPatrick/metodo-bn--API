# Foods — Carga inicial (Seed) TACO/TBCA

Carga inicial da base nutricional brasileira de alimentos, usada como catálogo
base do sistema (tabela `foods`). Custo zero: o dataset é **local**, sem
chamadas a APIs externas.

## Origem do dataset

Os valores nutricionais são representativos e alinhados a duas fontes públicas
oficiais brasileiras:

- **TACO** — Tabela Brasileira de Composição de Alimentos (NEPA/Unicamp).
- **TBCA** — Tabela Brasileira de Composição de Alimentos (USP/FoRC).

O arquivo `scripts/foods-taco-tbca.json` contém ~100 itens representativos.
Cada item traz macros **por 100g** e o campo `source` (`"TACO"` ou `"TBCA"`),
indicando a tabela de referência:

```json
{
  "name": "Arroz branco cozido",
  "source": "TACO",
  "category": "Cereais e derivados",
  "kcal": 128,
  "carbsG": 28.1,
  "proteinG": 2.5,
  "fatG": 0.2,
  "fiberG": 1.6,
  "sodiumMg": 1
}
```

Categorias cobertas: Cereais e derivados, Leguminosas, Carnes, Aves, Pescados,
Ovos, Frutas, Verduras e Legumes, Tubérculos, Laticínios, Óleos e Gorduras,
Castanhas e Oleaginosas, Açúcares e Doces.

Todos os itens da carga entram como base do catálogo:

- `isCustom = false` (não é alimento personalizado de nutricionista)
- `createdByNutritionistId = null`
- `isActive = true`

## Como rodar

Pré-requisitos: variáveis de ambiente de conexão configuradas (`.env`) e o
schema já existente. A ordem recomendada é:

```bash
npm run migrate        # aplica as migrations (inclui o índice de busca)
npm run db:seed-foods  # popula a tabela foods com o dataset TACO/TBCA
```

O script `db:seed-foods` executa `node scripts/seed-foods.js`.

## Estratégia de deduplicação

O seed é **idempotente**. A chave lógica de deduplicação é a combinação
**(`name`, `source`)**:

- Se o par (name, source) **não existe**, o item é **inserido**.
- Se **já existe** e algum macro/categoria **mudou**, o registro é **atualizado**.
- Se **já existe** e está **idêntico**, o item é **pulado**.

A operação inteira roda dentro de uma **transação Sequelize** (via
`findOrCreate` + `update`): se qualquer item falhar, nada é persistido. Ao final,
o script imprime um resumo (inseridos / atualizados / pulados / total) e encerra
com `process.exit(0)` em sucesso ou `process.exit(1)` em falha.

Reexecutar o seed quantas vezes for necessário é seguro — não gera duplicatas.

## Índice de busca (pg_trgm GIN)

A migration `migrations/20260623030000-foods-search-index.js`:

1. Cria a extensão `pg_trgm` (`CREATE EXTENSION IF NOT EXISTS pg_trgm;`).
2. Cria um índice **GIN** sobre `foods.name` com `gin_trgm_ops`, chamado
   `foods_name_trgm_gin`.

Esse índice acelera buscas **ILIKE parciais** (ex.: `WHERE name ILIKE '%arr%'`),
ideais para autocomplete de alimentos enquanto o usuário digita — casos em que o
índice B-tree comum em `name` não ajuda (prefixo livre `%...%`).

O `down()` apenas remove o índice (`DROP INDEX IF EXISTS foods_name_trgm_gin`),
preservando a extensão `pg_trgm`, que pode ser de uso compartilhado.
