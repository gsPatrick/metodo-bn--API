# migrations/

Migrations versionadas do schema PostgreSQL, geridas pelo `sequelize-cli`.

## Fluxo

- **Desenvolvimento rápido:** `npm run db:sync` recria/ajusta as tabelas a partir
  dos models (usa `sequelize.sync({ alter: true })`). Nunca usar em produção.
- **Produção / controlo de versão do schema:** criar migrations explícitas:

```bash
npx sequelize-cli migration:generate --name create-users
npm run migrate          # aplica pendentes
npm run migrate:undo     # reverte a última
```

## Regra do projeto

Toda alteração de model que mude o schema (nova coluna, índice, FK, ENUM) **deve**
ter migration correspondente. Não alterar apenas o model. Registar mudanças
relevantes em `src/documentacao/Registo_Migracoes.md`.

> A pasta começa vazia (apenas este README). A primeira migration deve criar as
> tabelas na ordem de dependência das FKs: `users` → `patient_profiles` →
> `patient_restriction`/`diet_plans`/... → tabelas filhas.
