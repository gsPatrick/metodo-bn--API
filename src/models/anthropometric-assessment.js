// src/models/anthropometric-assessment.js — avaliação antropométrica longitudinal.
// 1:N com PatientProfile (várias datas). É a fonte autoritativa de peso/altura para
// os cálculos (TDEE usa a avaliação mais recente). Circunferências, dobras e
// derivados ficam em JSONB por serem muitos e nem sempre coletados.
module.exports = (sequelize, DataTypes) => {
  const AnthropometricAssessment = sequelize.define(
    'AnthropometricAssessment',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      patientProfileId: { type: DataTypes.UUID, allowNull: false },
      nutritionistId: { type: DataTypes.UUID, allowNull: true },
      date: { type: DataTypes.DATEONLY, allowNull: false },

      heightCm: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      weightUsualKg: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
      weightCurrentKg: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
      imc: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      bodyFatPercent: { type: DataTypes.DECIMAL(5, 2), allowNull: true }, // % MG

      // Circunferências (cm): pescoço, braço(CB), cintura(CC), abdominal(CA),
      // quadril(CQ), coxa, panturrilha + RCQ.
      circumferences: { type: DataTypes.JSONB, allowNull: true },
      // Dobras cutâneas (mm): DCT, DCB, DCSE, DCSI, DCA, peito, abdominal, coxa, panturrilha.
      skinfolds: { type: DataTypes.JSONB, allowNull: true },
      // Derivados: AGB, CMB, AMB, AMBc, soma4, soma2.
      derived: { type: DataTypes.JSONB, allowNull: true },

      notes: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: 'anthropometric_assessments',
      indexes: [
        { fields: ['patient_profile_id'] },
        { fields: ['date'] },
        { fields: ['patient_profile_id', 'date'] },
      ],
    },
  );

  AnthropometricAssessment.associate = (models) => {
    AnthropometricAssessment.belongsTo(models.PatientProfile, { as: 'patient', foreignKey: 'patientProfileId', onDelete: 'CASCADE' });
    AnthropometricAssessment.belongsTo(models.User, { as: 'nutritionist', foreignKey: 'nutritionistId', onDelete: 'SET NULL' });
  };

  return AnthropometricAssessment;
};
