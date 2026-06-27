'use strict';

// Migration — enriquece o plano alimentar para guardar a importação completa do
// WebDiet:
//   - meals.{kcal,carbs_g,protein_g,fat_g}  (relatório de nutrientes por refeição)
//   - meal_items.{quantity_label,substitutions,kcal,carbs_g,protein_g,fat_g}
//   - recipes (receitas culinárias)
// Depende de: meals, meal_items, diet_plans.

const idCol = (Sequelize) => ({
  type: Sequelize.UUID,
  allowNull: false,
  primaryKey: true,
  defaultValue: Sequelize.literal('gen_random_uuid()'),
});
const timestamps = (Sequelize) => ({
  created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
  updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
});
const macro = (Sequelize) => ({ type: Sequelize.DECIMAL(8, 2), allowNull: true });

module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.sequelize.transaction(async (transaction) => {
      const t = { transaction };

      await queryInterface.addColumn('meals', 'kcal', macro(Sequelize), t);
      await queryInterface.addColumn('meals', 'carbs_g', macro(Sequelize), t);
      await queryInterface.addColumn('meals', 'protein_g', macro(Sequelize), t);
      await queryInterface.addColumn('meals', 'fat_g', macro(Sequelize), t);

      await queryInterface.addColumn('meal_items', 'quantity_label', { type: DataTypes.STRING(160), allowNull: true }, t);
      await queryInterface.addColumn('meal_items', 'substitutions', { type: DataTypes.JSONB, allowNull: true }, t);
      await queryInterface.addColumn('meal_items', 'kcal', macro(Sequelize), t);
      await queryInterface.addColumn('meal_items', 'carbs_g', macro(Sequelize), t);
      await queryInterface.addColumn('meal_items', 'protein_g', macro(Sequelize), t);
      await queryInterface.addColumn('meal_items', 'fat_g', macro(Sequelize), t);

      await queryInterface.createTable(
        'recipes',
        {
          id: idCol(Sequelize),
          diet_plan_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: 'diet_plans', key: 'id' },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
          name: { type: DataTypes.STRING(180), allowNull: false },
          yield: { type: DataTypes.STRING(80), allowNull: true },
          ingredients: { type: DataTypes.TEXT, allowNull: true },
          steps: { type: DataTypes.TEXT, allowNull: true },
          sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
          ...timestamps(Sequelize),
        },
        t,
      );
      await queryInterface.addIndex('recipes', ['diet_plan_id'], { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const t = { transaction };
      await queryInterface.dropTable('recipes', t);
      for (const c of ['quantity_label', 'substitutions', 'kcal', 'carbs_g', 'protein_g', 'fat_g']) {
        await queryInterface.removeColumn('meal_items', c, t);
      }
      for (const c of ['kcal', 'carbs_g', 'protein_g', 'fat_g']) {
        await queryInterface.removeColumn('meals', c, t);
      }
    });
  },
};
