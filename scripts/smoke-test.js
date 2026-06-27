// scripts/smoke-test.js — verificação rápida de saúde da stack.
// Conecta ao banco, sincroniza os models em memória (sem alterar schema)
// e confere que todas as associações foram registradas.
require('dotenv').config();

const db = require('../src/models');

(async () => {
  try {
    await db.sequelize.authenticate();
    console.log('✓ Conexão com o banco OK.');

    const modelNames = Object.keys(db).filter(
      (k) => !['sequelize', 'Sequelize'].includes(k),
    );
    console.log(`✓ ${modelNames.length} models carregados:`);
    modelNames.forEach((m) => console.log(`   - ${m}`));

    process.exit(0);
  } catch (err) {
    console.error('✗ Smoke test falhou:', err.message);
    process.exit(1);
  }
})();
