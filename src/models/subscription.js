// src/models/subscription.js — assinatura do paciente vinculada a um plano.
const { SUBSCRIPTION_STATUS, values } = require('../config/constants');

module.exports = (sequelize, DataTypes) => {
  const Subscription = sequelize.define(
    'Subscription',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      patientProfileId: { type: DataTypes.UUID, allowNull: false },
      paymentPlanId: { type: DataTypes.UUID, allowNull: false },
      status: {
        type: DataTypes.ENUM(...values(SUBSCRIPTION_STATUS)),
        allowNull: false,
        defaultValue: SUBSCRIPTION_STATUS.ACTIVE,
      },
      // IDs de rastreio no gateway externo (Asaas/Stripe/Pagar.me).
      gatewaySubscriptionId: { type: DataTypes.STRING, allowNull: true },
      gatewayCustomerId: { type: DataTypes.STRING, allowNull: true },
      startedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      currentPeriodEnd: { type: DataTypes.DATE, allowNull: true },
      canceledAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: 'subscriptions',
      indexes: [
        { fields: ['patient_profile_id'] },
        { fields: ['payment_plan_id'] },
        { fields: ['status'] },
        { fields: ['gateway_subscription_id'] },
      ],
    },
  );

  Subscription.associate = (models) => {
    Subscription.belongsTo(models.PatientProfile, { as: 'patient', foreignKey: 'patientProfileId', onDelete: 'CASCADE' });
    Subscription.belongsTo(models.PaymentPlan, { as: 'plan', foreignKey: 'paymentPlanId', onDelete: 'CASCADE' });
    Subscription.hasMany(models.PaymentTransaction, { as: 'transactions', foreignKey: 'subscriptionId', onDelete: 'CASCADE' });
  };

  return Subscription;
};
