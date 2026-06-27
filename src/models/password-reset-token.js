// src/models/password-reset-token.js — tokens de recuperação de senha.
// Guarda apenas o HASH; valida por expiração e marca usedAt após o reset.
module.exports = (sequelize, DataTypes) => {
  const PasswordResetToken = sequelize.define(
    'PasswordResetToken',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: { type: DataTypes.UUID, allowNull: false },
      tokenHash: { type: DataTypes.STRING(128), allowNull: false, unique: true },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      usedAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: 'password_reset_tokens',
      indexes: [
        { unique: true, fields: ['token_hash'] },
        { fields: ['user_id'] },
        { fields: ['expires_at'] },
      ],
    },
  );

  PasswordResetToken.prototype.isUsable = function isUsable() {
    return !this.usedAt && this.expiresAt.getTime() > Date.now();
  };

  PasswordResetToken.associate = (models) => {
    PasswordResetToken.belongsTo(models.User, { as: 'user', foreignKey: 'userId', onDelete: 'CASCADE' });
  };

  return PasswordResetToken;
};
