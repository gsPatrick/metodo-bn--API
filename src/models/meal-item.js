// src/models/meal-item.js — alimentos associados a uma refeição.
// Referencia Food (catálogo) ou usa texto livre como fallback customizado.
module.exports = (sequelize, DataTypes) => {
  const MealItem = sequelize.define(
    'MealItem',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      mealId: { type: DataTypes.UUID, allowNull: false },
      // Pode ser nulo quando o item é texto livre (customFoodName).
      foodId: { type: DataTypes.UUID, allowNull: true },
      // Fallback quando não há alimento no catálogo.
      customFoodName: { type: DataTypes.STRING(180), allowNull: true },

      quantity: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
      // Unidade de medida: "g", "ml", "unidade", "colher", etc.
      unit: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'g' },
      // Medida caseira por extenso (ex.: "3.5 Colher(es) de sopa rasa(s) (52.5g)").
      quantityLabel: { type: DataTypes.STRING(160), allowNull: true },
      // Opções de substituição: [{ name, qty }] (importadas do WebDiet).
      substitutions: { type: DataTypes.JSONB, allowNull: true },
      // Snapshot de macros do item (opcional).
      kcal: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
      carbsG: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
      proteinG: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
      fatG: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      notes: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: 'meal_items',
      indexes: [
        { fields: ['meal_id'] },
        { fields: ['food_id'] },
      ],
      validate: {
        // Garante que exista referência a um alimento OU um nome livre.
        hasFoodReference() {
          if (!this.foodId && !this.customFoodName) {
            throw new Error('MealItem requer foodId ou customFoodName.');
          }
        },
      },
    },
  );

  MealItem.associate = (models) => {
    MealItem.belongsTo(models.Meal, { as: 'meal', foreignKey: 'mealId', onDelete: 'CASCADE' });
    MealItem.belongsTo(models.Food, { as: 'food', foreignKey: 'foodId', onDelete: 'SET NULL' });
  };

  return MealItem;
};
