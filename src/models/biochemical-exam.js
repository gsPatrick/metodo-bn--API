// src/models/biochemical-exam.js — painel de exames bioquímicos por data.
// 1:N com PatientProfile. Resultados em JSONB (exame -> { encontrado, referencia }),
// permitindo qualquer painel sem explodir colunas.
module.exports = (sequelize, DataTypes) => {
  const BiochemicalExam = sequelize.define(
    'BiochemicalExam',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      patientProfileId: { type: DataTypes.UUID, allowNull: false },
      date: { type: DataTypes.DATEONLY, allowNull: true },
      laboratory: { type: DataTypes.STRING(160), allowNull: true },
      // Ex.: { "glicemiaJejum": { "encontrado": "92", "referencia": "70-99" }, ... }
      results: { type: DataTypes.JSONB, allowNull: true },
      otherExams: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: 'biochemical_exams',
      indexes: [
        { fields: ['patient_profile_id'] },
        { fields: ['date'] },
      ],
    },
  );

  BiochemicalExam.associate = (models) => {
    BiochemicalExam.belongsTo(models.PatientProfile, { as: 'patient', foreignKey: 'patientProfileId', onDelete: 'CASCADE' });
  };

  return BiochemicalExam;
};
