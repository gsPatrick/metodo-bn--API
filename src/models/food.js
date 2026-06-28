// src/models/food.js — base brasileira de alimentos (TACO/TBCA), macros por 100g.
// Suporta também alimentos personalizados criados por nutricionistas.
module.exports = (sequelize, DataTypes) => {
  const Food = sequelize.define(
    'Food',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: { type: DataTypes.STRING(180), allowNull: false },
      // Origem/fonte da informação nutricional.
      source: { type: DataTypes.STRING(40), allowNull: true, defaultValue: 'TACO' },
      category: { type: DataTypes.STRING(80), allowNull: true },

      // --- Macros por 100g ---
      kcal: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
      carbsG: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
      proteinG: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
      fatG: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
      fiberG: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
      sodiumMg: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },

      // Medidas caseiras oficiais (POF/IBGE): [{ label, grams }].
      householdMeasures: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },

      // --- Customização por nutricionista ---
      isCustom: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      createdByNutritionistId: { type: DataTypes.UUID, allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      // Contador de uso (mais adicionados/pesquisados) — base do ranking de
      // alimentos populares e do cache em memória. Indexado para ordenação rápida.
      usageCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    {
      tableName: 'foods',
      indexes: [
        { fields: ['name'] },
        { fields: ['category'] },
        { fields: ['is_custom'] },
        { fields: ['created_by_nutritionist_id'] },
        { fields: ['usage_count'] },
      ],
    },
  );

  Food.associate = (models) => {
    Food.belongsTo(models.User, {
      as: 'createdByNutritionist',
      foreignKey: 'createdByNutritionistId',
      onDelete: 'CASCADE',
    });
    Food.hasMany(models.MealItem, { as: 'mealItems', foreignKey: 'foodId', onDelete: 'SET NULL' });
    Food.hasMany(models.MealTemplateItem, { as: 'templateItems', foreignKey: 'foodId', onDelete: 'SET NULL' });
  };

  return Food;
};
