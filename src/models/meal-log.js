// src/models/meal-log.js — registro diário de consumo dos itens do plano.
// Uma linha por (paciente, dia, item do plano): consumiu / trocou / não consumiu.
module.exports = (sequelize, DataTypes) => {
  const MealLog = sequelize.define(
    'MealLog',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      patientProfileId: { type: DataTypes.UUID, allowNull: false },
      // Dia de referência (YYYY-MM-DD).
      date: { type: DataTypes.DATEONLY, allowNull: false },
      // Item do plano alimentar (alimento prescrito) ao qual o registro se refere.
      mealItemId: { type: DataTypes.UUID, allowNull: false },
      // consumed | swapped | skipped
      status: { type: DataTypes.STRING(20), allowNull: false },
      // Se status = swapped, qual alimento foi consumido no lugar.
      swappedFoodId: { type: DataTypes.UUID, allowNull: true },
      swappedFoodName: { type: DataTypes.STRING(160), allowNull: true },
    },
    {
      tableName: 'meal_logs',
      indexes: [
        { fields: ['patient_profile_id'] },
        { fields: ['date'] },
        { unique: true, fields: ['patient_profile_id', 'date', 'meal_item_id'] },
      ],
    },
  );

  MealLog.associate = (models) => {
    MealLog.belongsTo(models.PatientProfile, { as: 'patientProfile', foreignKey: 'patientProfileId', onDelete: 'CASCADE' });
    MealLog.belongsTo(models.MealItem, { as: 'mealItem', foreignKey: 'mealItemId', onDelete: 'CASCADE' });
    MealLog.belongsTo(models.Food, { as: 'swappedFood', foreignKey: 'swappedFoodId', onDelete: 'SET NULL' });
  };

  return MealLog;
};
