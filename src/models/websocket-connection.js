// src/models/websocket-connection.js — presença/rastreamento de conexões Socket.io.
// Permite envio direcionado e auditoria de sessões em tempo real.
module.exports = (sequelize, DataTypes) => {
  const WebSocketConnection = sequelize.define(
    'WebSocketConnection',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: { type: DataTypes.UUID, allowNull: false },
      // Identificador da conexão emitido pelo Socket.io.
      socketId: { type: DataTypes.STRING, allowNull: false, unique: true },
      connectedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      disconnectedAt: { type: DataTypes.DATE, allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: 'websocket_connections',
      indexes: [
        { unique: true, fields: ['socket_id'] },
        { fields: ['user_id'] },
        { fields: ['is_active'] },
      ],
    },
  );

  WebSocketConnection.associate = (models) => {
    WebSocketConnection.belongsTo(models.User, { as: 'user', foreignKey: 'userId', onDelete: 'CASCADE' });
  };

  return WebSocketConnection;
};
