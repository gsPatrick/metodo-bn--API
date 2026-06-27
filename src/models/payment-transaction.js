// src/models/payment-transaction.js — log financeiro de cada tentativa de pagamento.
const { PAYMENT_STATUS, PAYMENT_METHODS, values } = require('../config/constants');

module.exports = (sequelize, DataTypes) => {
  const PaymentTransaction = sequelize.define(
    'PaymentTransaction',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      subscriptionId: { type: DataTypes.UUID, allowNull: false },
      amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'BRL' },
      method: {
        type: DataTypes.ENUM(...values(PAYMENT_METHODS)),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM(...values(PAYMENT_STATUS)),
        allowNull: false,
        defaultValue: PAYMENT_STATUS.PENDING,
      },
      // ID da cobrança/transação no gateway (idempotência de webhook).
      gatewayTransactionId: { type: DataTypes.STRING, allowNull: true, unique: true },
      // Payload bruto retornado pelo webhook do gateway.
      gatewayPayload: { type: DataTypes.JSONB, allowNull: true },
      paidAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: 'payment_transactions',
      indexes: [
        { fields: ['subscription_id'] },
        { fields: ['status'] },
        { fields: ['method'] },
        { unique: true, fields: ['gateway_transaction_id'] },
      ],
    },
  );

  PaymentTransaction.associate = (models) => {
    PaymentTransaction.belongsTo(models.Subscription, { as: 'subscription', foreignKey: 'subscriptionId', onDelete: 'CASCADE' });
  };

  return PaymentTransaction;
};
