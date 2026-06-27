// src/models/device-token.js — tokens de push (FCM/APNS) por dispositivo.
const { DEVICE_PLATFORMS, values } = require('../config/constants');

module.exports = (sequelize, DataTypes) => {
  const DeviceToken = sequelize.define(
    'DeviceToken',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: { type: DataTypes.UUID, allowNull: false },
      // Token FCM/APNS — único para evitar duplicação de envio.
      token: { type: DataTypes.STRING, allowNull: false, unique: true },
      platform: {
        type: DataTypes.ENUM(...values(DEVICE_PLATFORMS)),
        allowNull: false,
      },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      lastUsedAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: 'device_tokens',
      indexes: [
        { unique: true, fields: ['token'] },
        { fields: ['user_id'] },
        { fields: ['is_active'] },
      ],
    },
  );

  DeviceToken.associate = (models) => {
    DeviceToken.belongsTo(models.User, { as: 'user', foreignKey: 'userId', onDelete: 'CASCADE' });
  };

  return DeviceToken;
};
