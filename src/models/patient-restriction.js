// src/models/patient-restriction.js — alergias, intolerâncias e preferências.
const { RESTRICTION_TYPES, values } = require('../config/constants');

module.exports = (sequelize, DataTypes) => {
  const PatientRestriction = sequelize.define(
    'PatientRestriction',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      patientProfileId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      type: {
        type: DataTypes.ENUM(...values(RESTRICTION_TYPES)),
        allowNull: false,
        defaultValue: RESTRICTION_TYPES.PREFERENCE,
      },
      // Termo livre: "lactose", "amendoim", "vegetariano", etc.
      label: { type: DataTypes.STRING(120), allowNull: false },
      notes: { type: DataTypes.TEXT, allowNull: true },
      // Origem: 'manual' (cadastrada direto) ou 'anamnesis' (sincronizada do prontuário).
      source: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'manual' },
    },
    {
      tableName: 'patient_restrictions',
      indexes: [
        { fields: ['patient_profile_id'] },
        { fields: ['type'] },
        { fields: ['source'] },
      ],
    },
  );

  PatientRestriction.associate = (models) => {
    PatientRestriction.belongsTo(models.PatientProfile, {
      as: 'profile',
      foreignKey: 'patientProfileId',
      onDelete: 'CASCADE',
    });
  };

  return PatientRestriction;
};
