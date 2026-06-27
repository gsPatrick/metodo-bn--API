// src/models/monetization-config.js — liga/desliga o fluxo de cobrança.
// Pode ser global (nutritionist_id nulo) ou por nutricionista.
module.exports = (sequelize, DataTypes) => {
  const MonetizationConfig = sequelize.define(
    'MonetizationConfig',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      // Nulo = configuração global do sistema; preenchido = por nutricionista.
      nutritionistId: { type: DataTypes.UUID, allowNull: true, unique: true },
      isEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      // Identificador da conta/subconta no gateway (split, marketplace).
      gatewayAccountId: { type: DataTypes.STRING, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: 'monetization_configs',
      indexes: [
        { unique: true, fields: ['nutritionist_id'] },
        { fields: ['is_enabled'] },
      ],
    },
  );

  MonetizationConfig.associate = (models) => {
    MonetizationConfig.belongsTo(models.User, { as: 'nutritionist', foreignKey: 'nutritionistId', onDelete: 'CASCADE' });
  };

  return MonetizationConfig;
};
