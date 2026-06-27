// scripts/db-sync.js — bootstrap de schema para DESENVOLVIMENTO.
// Cria/ajusta as tabelas a partir dos models (sequelize.sync).
// ATENÇÃO: em produção use migrations versionadas, não este script.
require('dotenv').config();

const db = require('../src/models');

const alter = process.argv.includes('--alter');
const force = process.argv.includes('--force');

(async () => {
  try {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('db-sync é apenas para desenvolvimento. Use migrations em produção.');
    }
    await db.sequelize.authenticate();
    await db.sequelize.sync({ alter, force });
    console.log(`✓ Schema sincronizado (alter=${alter}, force=${force}).`);
    process.exit(0);
  } catch (err) {
    console.error('✗ db-sync falhou:', err.message);
    process.exit(1);
  }
})();
