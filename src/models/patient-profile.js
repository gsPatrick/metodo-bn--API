// src/models/patient-profile.js — atributos clínicos/antropométricos do paciente.
// Vínculo obrigatório com a nutricionista (nutritionist_id -> User).
const { ACTIVITY_LEVELS, GOALS, SEX, values } = require('../config/constants');

module.exports = (sequelize, DataTypes) => {
  const PatientProfile = sequelize.define(
    'PatientProfile',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      // Usuário (role=patient) dono deste perfil. 1:1.
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
      },
      // Nutricionista responsável (vínculo obrigatório).
      nutritionistId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      birthDate: { type: DataTypes.DATEONLY, allowNull: true },
      sex: { type: DataTypes.ENUM(...values(SEX)), allowNull: true },
      heightCm: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      weightKg: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      activityLevel: {
        type: DataTypes.ENUM(...values(ACTIVITY_LEVELS)),
        allowNull: true,
        defaultValue: ACTIVITY_LEVELS.SEDENTARY,
      },
      goal: {
        type: DataTypes.ENUM(...values(GOALS)),
        allowNull: true,
        defaultValue: GOALS.MAINTAIN,
      },
      // Notas clínicas livres da nutricionista.
      clinicalNotes: { type: DataTypes.TEXT, allowNull: true },
      // Teto de gastos de compras definido pelo paciente (config). Usado como
      // limite padrão no "Modo Compra" quando a sessão não define um próprio.
      shoppingBudget: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    },
    {
      tableName: 'patient_profiles',
      indexes: [
        { unique: true, fields: ['user_id'] },
        { fields: ['nutritionist_id'] },
      ],
    },
  );

  PatientProfile.associate = (models) => {
    PatientProfile.belongsTo(models.User, { as: 'user', foreignKey: 'userId', onDelete: 'CASCADE' });
    PatientProfile.belongsTo(models.User, { as: 'nutritionist', foreignKey: 'nutritionistId', onDelete: 'CASCADE' });

    PatientProfile.hasMany(models.PatientRestriction, {
      as: 'restrictions',
      foreignKey: 'patientProfileId',
      onDelete: 'CASCADE',
    });
    PatientProfile.hasMany(models.DietPlan, { as: 'dietPlans', foreignKey: 'patientProfileId', onDelete: 'CASCADE' });
    PatientProfile.hasMany(models.ShoppingList, { as: 'shoppingLists', foreignKey: 'patientProfileId', onDelete: 'CASCADE' });
    PatientProfile.hasMany(models.PurchaseHistory, { as: 'purchases', foreignKey: 'patientProfileId', onDelete: 'CASCADE' });
    PatientProfile.hasMany(models.DailyHealthMetric, { as: 'healthMetrics', foreignKey: 'patientProfileId', onDelete: 'CASCADE' });
    PatientProfile.hasMany(models.Subscription, { as: 'subscriptions', foreignKey: 'patientProfileId', onDelete: 'CASCADE' });

    // Anamnese e registros clínicos longitudinais.
    PatientProfile.hasOne(models.Anamnesis, { as: 'anamnesis', foreignKey: 'patientProfileId', onDelete: 'CASCADE' });
    PatientProfile.hasMany(models.AnthropometricAssessment, { as: 'assessments', foreignKey: 'patientProfileId', onDelete: 'CASCADE' });
    PatientProfile.hasMany(models.BiochemicalExam, { as: 'biochemicalExams', foreignKey: 'patientProfileId', onDelete: 'CASCADE' });
    PatientProfile.hasMany(models.NutritionalEvolution, { as: 'evolutions', foreignKey: 'patientProfileId', onDelete: 'CASCADE' });
  };

  return PatientProfile;
};
