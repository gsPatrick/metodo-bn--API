// src/models/recipe.js — receitas culinárias de um plano alimentar (WebDiet).
module.exports = (sequelize, DataTypes) => {
  const Recipe = sequelize.define(
    'Recipe',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      dietPlanId: { type: DataTypes.UUID, allowNull: false },
      name: { type: DataTypes.STRING(180), allowNull: false },
      // Rendimento por extenso (ex.: "2 porção(ões)").
      yield: { type: DataTypes.STRING(80), allowNull: true },
      ingredients: { type: DataTypes.TEXT, allowNull: true },
      steps: { type: DataTypes.TEXT, allowNull: true },
      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    {
      tableName: 'recipes',
      indexes: [{ fields: ['diet_plan_id'] }],
    },
  );

  Recipe.associate = (models) => {
    Recipe.belongsTo(models.DietPlan, { as: 'dietPlan', foreignKey: 'dietPlanId', onDelete: 'CASCADE' });
  };

  return Recipe;
};
