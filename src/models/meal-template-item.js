// src/models/meal-template-item.js — itens de um modelo de refeição.
// Mesma forma do MealItem (Food referenciada ou texto livre de fallback).
module.exports = (sequelize, DataTypes) => {
  const MealTemplateItem = sequelize.define(
    'MealTemplateItem',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      mealTemplateId: { type: DataTypes.UUID, allowNull: false },
      foodId: { type: DataTypes.UUID, allowNull: true },
      customFoodName: { type: DataTypes.STRING(180), allowNull: true },
      quantity: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
      unit: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'g' },
      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    {
      tableName: 'meal_template_items',
      indexes: [
        { fields: ['meal_template_id'] },
        { fields: ['food_id'] },
      ],
      validate: {
        hasFoodReference() {
          if (!this.foodId && !this.customFoodName) {
            throw new Error('MealTemplateItem requer foodId ou customFoodName.');
          }
        },
      },
    },
  );

  MealTemplateItem.associate = (models) => {
    MealTemplateItem.belongsTo(models.MealTemplate, { as: 'template', foreignKey: 'mealTemplateId', onDelete: 'CASCADE' });
    MealTemplateItem.belongsTo(models.Food, { as: 'food', foreignKey: 'foodId', onDelete: 'SET NULL' });
  };

  return MealTemplateItem;
};
