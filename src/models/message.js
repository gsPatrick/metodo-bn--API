// src/models/message.js — mensagem do chat (texto, imagem, documento ou áudio).
module.exports = (sequelize, DataTypes) => {
  const Message = sequelize.define(
    'Message',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      conversationId: { type: DataTypes.UUID, allowNull: false },
      // Autor (usuário). O destinatário é o outro lado da conversa.
      senderId: { type: DataTypes.UUID, allowNull: false },
      // text | image | doc | audio
      type: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'text' },
      body: { type: DataTypes.TEXT, allowNull: true },
      // Anexos: URL (ou data URL) + metadados.
      attachmentUrl: { type: DataTypes.TEXT, allowNull: true },
      attachmentName: { type: DataTypes.STRING(200), allowNull: true },
      attachmentSize: { type: DataTypes.STRING(40), allowNull: true },
      durationSec: { type: DataTypes.INTEGER, allowNull: true }, // áudio
      readAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: 'messages',
      indexes: [
        { fields: ['conversation_id'] },
        { fields: ['conversation_id', 'created_at'] },
      ],
    },
  );

  Message.associate = (models) => {
    Message.belongsTo(models.Conversation, { as: 'conversation', foreignKey: 'conversationId', onDelete: 'CASCADE' });
    Message.belongsTo(models.User, { as: 'sender', foreignKey: 'senderId', onDelete: 'CASCADE' });
  };

  return Message;
};
