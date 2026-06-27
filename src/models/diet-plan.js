// src/models/diet-plan.js — plano alimentar com metas macro e status de aprovação.
const { DIET_PLAN_STATUS, values } = require('../config/constants');

module.exports = (sequelize, DataTypes) => {
  const DietPlan = sequelize.define(
    'DietPlan',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      patientProfileId: { type: DataTypes.UUID, allowNull: false },
      // Nutricionista autora (redundância útil para queries diretas/segurança).
      nutritionistId: { type: DataTypes.UUID, allowNull: false },
      title: { type: DataTypes.STRING(160), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },

      // --- Metas macro-nutricionais gerais ---
      targetKcal: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
      targetCarbsG: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
      targetProteinG: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
      targetFatG: { type: DataTypes.DECIMAL(8, 2), allowNull: true },

      // draft enquanto editado; approved libera ao paciente.
      status: {
        type: DataTypes.ENUM(...values(DIET_PLAN_STATUS)),
        allowNull: false,
        defaultValue: DIET_PLAN_STATUS.DRAFT,
      },
      approvedAt: { type: DataTypes.DATE, allowNull: true },
      startDate: { type: DataTypes.DATEONLY, allowNull: true },
      endDate: { type: DataTypes.DATEONLY, allowNull: true },
    },
    {
      tableName: 'diet_plans',
      indexes: [
        { fields: ['patient_profile_id'] },
        { fields: ['nutritionist_id'] },
        { fields: ['status'] },
      ],
    },
  );

  DietPlan.associate = (models) => {
    DietPlan.belongsTo(models.PatientProfile, { as: 'patient', foreignKey: 'patientProfileId', onDelete: 'CASCADE' });
    DietPlan.belongsTo(models.User, { as: 'nutritionist', foreignKey: 'nutritionistId', onDelete: 'CASCADE' });
    DietPlan.hasMany(models.Meal, { as: 'meals', foreignKey: 'dietPlanId', onDelete: 'CASCADE' });
    DietPlan.hasMany(models.Recipe, { as: 'recipes', foreignKey: 'dietPlanId', onDelete: 'CASCADE' });
    DietPlan.hasMany(models.ShoppingList, { as: 'shoppingLists', foreignKey: 'dietPlanId', onDelete: 'SET NULL' });
  };

  return DietPlan;
};
