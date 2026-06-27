'use strict';

// Migration — suporte a orçamento (teto de gastos) do Modo Compra:
//   - patient_profiles.shopping_budget (config padrão do paciente)
//   - shopping_lists.budget (orçamento específico da sessão de compra)
// Depende de `patient_profiles` e `shopping_lists` (migration inicial).

module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.sequelize.transaction(async (transaction) => {
      const t = { transaction };
      await queryInterface.addColumn(
        'patient_profiles',
        'shopping_budget',
        { type: DataTypes.DECIMAL(10, 2), allowNull: true },
        t,
      );
      await queryInterface.addColumn(
        'shopping_lists',
        'budget',
        { type: DataTypes.DECIMAL(10, 2), allowNull: true },
        t,
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const t = { transaction };
      await queryInterface.removeColumn('shopping_lists', 'budget', t);
      await queryInterface.removeColumn('patient_profiles', 'shopping_budget', t);
    });
  },
};
