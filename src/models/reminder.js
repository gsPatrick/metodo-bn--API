// src/models/reminder.js — lembretes do paciente (água, refeição, treino…).
module.exports = (sequelize, DataTypes) => {
  const Reminder = sequelize.define(
    'Reminder',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      patientProfileId: { type: DataTypes.UUID, allowNull: false },
      // water | meal | workout | custom
      type: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'custom' },
      title: { type: DataTypes.STRING(120), allowNull: false },
      // Horário do lembrete (apenas hora).
      timeOfDay: { type: DataTypes.TIME, allowNull: true },
      enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: 'reminders',
      indexes: [{ fields: ['patient_profile_id'] }],
    },
  );

  Reminder.associate = (models) => {
    Reminder.belongsTo(models.PatientProfile, { as: 'patientProfile', foreignKey: 'patientProfileId', onDelete: 'CASCADE' });
  };

  return Reminder;
};
