// src/models/meal.js — refeições agrupadas dentro de um plano alimentar.
module.exports = (sequelize, DataTypes) => {
  const Meal = sequelize.define(
    'Meal',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      dietPlanId: { type: DataTypes.UUID, allowNull: false },
      name: { type: DataTypes.STRING(120), allowNull: false }, // ex: "Almoço"
      // Ordenação manual das refeições no plano.
      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      // Horário preferencial (apenas hora, sem data).
      preferredTime: { type: DataTypes.TIME, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      // Snapshot de macros da refeição (ex.: relatório do WebDiet).
      kcal: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
      carbsG: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
      proteinG: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
      fatG: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
    },
    {
      tableName: 'meals',
      indexes: [
        { fields: ['diet_plan_id'] },
        { fields: ['diet_plan_id', 'sort_order'] },
      ],
    },
  );

  Meal.associate = (models) => {
    Meal.belongsTo(models.DietPlan, { as: 'dietPlan', foreignKey: 'dietPlanId', onDelete: 'CASCADE' });
    Meal.hasMany(models.MealItem, { as: 'items', foreignKey: 'mealId', onDelete: 'CASCADE' });
  };

  return Meal;
};
