// src/models/daily-health-metric.js — métricas diárias para o lifestyle score.
module.exports = (sequelize, DataTypes) => {
  const DailyHealthMetric = sequelize.define(
    'DailyHealthMetric',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      patientProfileId: { type: DataTypes.UUID, allowNull: false },
      // Dia de referência (uma métrica por paciente por dia).
      date: { type: DataTypes.DATEONLY, allowNull: false },

      sleepHours: { type: DataTypes.DECIMAL(4, 2), allowNull: true },
      steps: { type: DataTypes.INTEGER, allowNull: true },
      waterMl: { type: DataTypes.INTEGER, allowNull: true },
      // Treinou hoje? (usado na gamificação do app do paciente).
      trainedToday: { type: DataTypes.BOOLEAN, allowNull: true },
      // Escalas 1-10.
      stressLevel: { type: DataTypes.INTEGER, allowNull: true, validate: { min: 1, max: 10 } },
      dietAdherence: { type: DataTypes.INTEGER, allowNull: true, validate: { min: 1, max: 10 } },
      // Score final calculado pelo service a partir das métricas acima.
      calculatedHealthScore: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
    },
    {
      tableName: 'daily_health_metrics',
      indexes: [
        { fields: ['patient_profile_id'] },
        { fields: ['date'] },
        // Garante uma única métrica por paciente por dia.
        { unique: true, fields: ['patient_profile_id', 'date'] },
      ],
    },
  );

  DailyHealthMetric.associate = (models) => {
    DailyHealthMetric.belongsTo(models.PatientProfile, { as: 'patient', foreignKey: 'patientProfileId', onDelete: 'CASCADE' });
  };

  return DailyHealthMetric;
};
