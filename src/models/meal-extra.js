// src/models/meal-extra.js — "comeu a mais": alimentos consumidos fora do plano.
// Vinculado opcionalmente a uma refeição do plano; guarda os macros do item.
module.exports = (sequelize, DataTypes) => {
  const MealExtra = sequelize.define(
    'MealExtra',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      patientProfileId: { type: DataTypes.UUID, allowNull: false },
      date: { type: DataTypes.DATEONLY, allowNull: false },
      // Refeição do plano a que o extra foi associado (opcional).
      mealId: { type: DataTypes.UUID, allowNull: true },
      // Alimento do catálogo (opcional) e/ou nome livre digitado pelo paciente.
      foodId: { type: DataTypes.UUID, allowNull: true },
      foodName: { type: DataTypes.STRING(160), allowNull: false },
      quantityG: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
      // Macros do item já calculados para a quantidade consumida.
      kcal: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
      carbsG: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
      proteinG: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
      fatG: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
    },
    {
      tableName: 'meal_extras',
      indexes: [
        { fields: ['patient_profile_id'] },
        { fields: ['date'] },
        { fields: ['patient_profile_id', 'date'] },
      ],
    },
  );

  MealExtra.associate = (models) => {
    MealExtra.belongsTo(models.PatientProfile, { as: 'patientProfile', foreignKey: 'patientProfileId', onDelete: 'CASCADE' });
    MealExtra.belongsTo(models.Meal, { as: 'meal', foreignKey: 'mealId', onDelete: 'SET NULL' });
    MealExtra.belongsTo(models.Food, { as: 'food', foreignKey: 'foodId', onDelete: 'SET NULL' });
  };

  return MealExtra;
};
