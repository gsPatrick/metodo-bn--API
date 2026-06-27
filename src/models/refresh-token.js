// src/models/refresh-token.js — refresh tokens de sessão (rotação + revogação).
// Armazena apenas o HASH do token (nunca o valor bruto). Suporta rotação:
// ao renovar, o token antigo é revogado e aponta para o novo (replacedByTokenHash).
module.exports = (sequelize, DataTypes) => {
  const RefreshToken = sequelize.define(
    'RefreshToken',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: { type: DataTypes.UUID, allowNull: false },
      // SHA-256 hex do token bruto (64 chars).
      tokenHash: { type: DataTypes.STRING(128), allowNull: false, unique: true },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      revokedAt: { type: DataTypes.DATE, allowNull: true },
      // Hash do token que substituiu este (cadeia de rotação / detecção de reuso).
      replacedByTokenHash: { type: DataTypes.STRING(128), allowNull: true },
      userAgent: { type: DataTypes.STRING, allowNull: true },
      ipAddress: { type: DataTypes.STRING(64), allowNull: true },
    },
    {
      tableName: 'refresh_tokens',
      indexes: [
        { unique: true, fields: ['token_hash'] },
        { fields: ['user_id'] },
        { fields: ['expires_at'] },
      ],
    },
  );

  // Helpers de estado de validade.
  RefreshToken.prototype.isExpired = function isExpired() {
    return this.expiresAt.getTime() <= Date.now();
  };
  RefreshToken.prototype.isActive = function isActive() {
    return !this.revokedAt && !this.isExpired();
  };

  RefreshToken.associate = (models) => {
    RefreshToken.belongsTo(models.User, { as: 'user', foreignKey: 'userId', onDelete: 'CASCADE' });
  };

  return RefreshToken;
};
