// src/models/payment-plan.js — planos de cobrança definidos pela nutricionista.
module.exports = (sequelize, DataTypes) => {
  const PaymentPlan = sequelize.define(
    'PaymentPlan',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      nutritionistId: { type: DataTypes.UUID, allowNull: false },
      name: { type: DataTypes.STRING(160), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      // Ciclo em dias: 30, 90, 365, etc.
      cycleDays: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30 },
      currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'BRL' },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: 'payment_plans',
      indexes: [
        { fields: ['nutritionist_id'] },
        { fields: ['is_active'] },
      ],
    },
  );

  PaymentPlan.associate = (models) => {
    PaymentPlan.belongsTo(models.User, { as: 'nutritionist', foreignKey: 'nutritionistId', onDelete: 'CASCADE' });
    PaymentPlan.hasMany(models.Subscription, { as: 'subscriptions', foreignKey: 'paymentPlanId', onDelete: 'CASCADE' });
  };

  return PaymentPlan;
};
