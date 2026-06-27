// src/models/patient-achievement.js — conquistas (badges) desbloqueadas pelo paciente.
module.exports = (sequelize, DataTypes) => {
  const PatientAchievement = sequelize.define(
    'PatientAchievement',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      patientProfileId: { type: DataTypes.UUID, allowNull: false },
      // Código do catálogo (constants.ACHIEVEMENTS).
      code: { type: DataTypes.STRING(40), allowNull: false },
      unlockedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      tableName: 'patient_achievements',
      indexes: [
        { fields: ['patient_profile_id'] },
        { unique: true, fields: ['patient_profile_id', 'code'] },
      ],
    },
  );

  PatientAchievement.associate = (models) => {
    PatientAchievement.belongsTo(models.PatientProfile, { as: 'patientProfile', foreignKey: 'patientProfileId', onDelete: 'CASCADE' });
  };

  return PatientAchievement;
};
