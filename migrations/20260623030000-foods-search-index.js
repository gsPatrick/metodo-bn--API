'use strict';

// Migration — índice de busca por similaridade textual em foods.name.
// Cria a extensão pg_trgm e um índice GIN (gin_trgm_ops) que acelera buscas
// ILIKE parciais (ex.: "%arr%") durante a digitação no autocomplete de alimentos.
//
// Depende de `foods` (criada na migration inicial).

const INDEX_NAME = 'foods_name_trgm_gin';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const t = { transaction };

      // Extensão de trigramas — habilita gin_trgm_ops para ILIKE/LIKE parciais.
      await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS pg_trgm;', t);

      // Índice GIN sobre o nome do alimento para buscas parciais rápidas.
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS ${INDEX_NAME} ON foods USING gin (name gin_trgm_ops);`,
        t,
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const t = { transaction };
      // Remove apenas o índice; a extensão pg_trgm é preservada (uso compartilhado).
      await queryInterface.sequelize.query(`DROP INDEX IF EXISTS ${INDEX_NAME};`, t);
    });
  },
};
