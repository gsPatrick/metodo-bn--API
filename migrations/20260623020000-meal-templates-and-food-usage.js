'use strict';

// Migration — suporte aos módulos food e diet-plan:
//   1. Coluna foods.usage_count (ranking de alimentos populares) + índice.
//   2. Tabelas meal_templates e meal_template_items (modelos de refeição).
// Depende de `users` e `foods` (migration inicial).

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

module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;

    await queryInterface.sequelize.transaction(async (transaction) => {
      const t = { transaction };

      // 1. foods.usage_count + índice
      await queryInterface.addColumn(
        'foods',
        'usage_count',
        { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        t,
      );
      await queryInterface.addIndex('foods', ['usage_count'], { transaction, name: 'foods_usage_count_idx' });

      // 2. meal_templates
      await queryInterface.createTable(
        'meal_templates',
        {
          id: idCol(Sequelize),
          nutritionist_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'users', key: 'id' },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
          name: { type: DataTypes.STRING(160), allowNull: false },
          description: { type: DataTypes.TEXT, allowNull: true },
          preferred_time: { type: DataTypes.TIME, allowNull: true },
          total_kcal: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
          total_carbs_g: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
          total_protein_g: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
          total_fat_g: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
          usage_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
          is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
          ...timestamps(Sequelize),
        },
        t,
      );

      // 3. meal_template_items
      await queryInterface.createTable(
        'meal_template_items',
        {
          id: idCol(Sequelize),
          meal_template_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'meal_templates', key: 'id' },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
          food_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: { model: 'foods', key: 'id' },
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE',
          },
          custom_food_name: { type: DataTypes.STRING(180), allowNull: true },
          quantity: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
          unit: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'g' },
          sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
          ...timestamps(Sequelize),
        },
        t,
      );

      const idx = (table, fields, options = {}) =>
        queryInterface.addIndex(table, fields, { transaction, ...options });

      await idx('meal_templates', ['nutritionist_id']);
      await idx('meal_templates', ['name']);
      await idx('meal_templates', ['usage_count']);
      await idx('meal_template_items', ['meal_template_id']);
      await idx('meal_template_items', ['food_id']);
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const t = { transaction };
      await queryInterface.dropTable('meal_template_items', t);
      await queryInterface.dropTable('meal_templates', t);
      await queryInterface.removeIndex('foods', 'foods_usage_count_idx', t);
      await queryInterface.removeColumn('foods', 'usage_count', t);
    });
  },
};
