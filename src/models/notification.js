// src/models/notification.js — histórico de notificações por usuário.
const { NOTIFICATION_TYPES, values } = require('../config/constants');

module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define(
    'Notification',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: { type: DataTypes.UUID, allowNull: false }, // destinatário
      title: { type: DataTypes.STRING(160), allowNull: false },
      message: { type: DataTypes.TEXT, allowNull: false },
      type: {
        type: DataTypes.ENUM(...values(NOTIFICATION_TYPES)),
        allowNull: false,
        defaultValue: NOTIFICATION_TYPES.SYSTEM_ALERT,
      },
      isRead: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      readAt: { type: DataTypes.DATE, allowNull: true },
      // Payload extra para deep-linking no app (ex: { dietPlanId, screen }).
      metadata: { type: DataTypes.JSONB, allowNull: true },
    },
    {
      tableName: 'notifications',
      indexes: [
        { fields: ['user_id'] },
        { fields: ['is_read'] },
        { fields: ['type'] },
        // Listagem típica: notificações não lidas de um usuário, mais recentes.
        { fields: ['user_id', 'is_read', 'created_at'] },
      ],
    },
  );

  Notification.associate = (models) => {
    Notification.belongsTo(models.User, { as: 'user', foreignKey: 'userId', onDelete: 'CASCADE' });
  };

  return Notification;
};
