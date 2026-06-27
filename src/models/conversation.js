// src/models/conversation.js — conversa 1:1 entre nutricionista e paciente.
module.exports = (sequelize, DataTypes) => {
  const Conversation = sequelize.define(
    'Conversation',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      nutritionistId: { type: DataTypes.UUID, allowNull: false },
      patientProfileId: { type: DataTypes.UUID, allowNull: false },
      // Cache para listar conversas sem agregar mensagens.
      lastMessageAt: { type: DataTypes.DATE, allowNull: true },
      lastMessagePreview: { type: DataTypes.STRING(160), allowNull: true },
      // Contadores de não lidas por lado (mantidos pelo service).
      nutriUnread: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      patientUnread: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    {
      tableName: 'conversations',
      indexes: [
        { fields: ['nutritionist_id'] },
        { fields: ['patient_profile_id'] },
        { unique: true, fields: ['nutritionist_id', 'patient_profile_id'] },
      ],
    },
  );

  Conversation.associate = (models) => {
    Conversation.belongsTo(models.User, { as: 'nutritionist', foreignKey: 'nutritionistId', onDelete: 'CASCADE' });
    Conversation.belongsTo(models.PatientProfile, { as: 'patientProfile', foreignKey: 'patientProfileId', onDelete: 'CASCADE' });
    Conversation.hasMany(models.Message, { as: 'messages', foreignKey: 'conversationId', onDelete: 'CASCADE' });
  };

  return Conversation;
};
