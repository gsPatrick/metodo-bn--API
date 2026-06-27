// src/models/nutritional-evolution.js — evolução nutricional (notas ao longo do tempo).
// 1:N com PatientProfile. Cada consulta/retorno registra uma nota datada.
module.exports = (sequelize, DataTypes) => {
  const NutritionalEvolution = sequelize.define(
    'NutritionalEvolution',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      patientProfileId: { type: DataTypes.UUID, allowNull: false },
      nutritionistId: { type: DataTypes.UUID, allowNull: true },
      date: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
      notes: { type: DataTypes.TEXT, allowNull: false },
    },
    {
      tableName: 'nutritional_evolutions',
      indexes: [
        { fields: ['patient_profile_id'] },
        { fields: ['date'] },
      ],
    },
  );

  NutritionalEvolution.associate = (models) => {
    NutritionalEvolution.belongsTo(models.PatientProfile, { as: 'patient', foreignKey: 'patientProfileId', onDelete: 'CASCADE' });
    NutritionalEvolution.belongsTo(models.User, { as: 'nutritionist', foreignKey: 'nutritionistId', onDelete: 'SET NULL' });
  };

  return NutritionalEvolution;
};
