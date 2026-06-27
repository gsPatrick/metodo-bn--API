// src/models/purchase-history.js — registro de cada compra finalizada.
module.exports = (sequelize, DataTypes) => {
  const PurchaseHistory = sequelize.define(
    'PurchaseHistory',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      patientProfileId: { type: DataTypes.UUID, allowNull: false },
      // Lista de origem (opcional — compra pode ser avulsa).
      shoppingListId: { type: DataTypes.UUID, allowNull: true },
      marketId: { type: DataTypes.UUID, allowNull: true },
      totalAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      purchasedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      notes: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: 'purchase_histories',
      indexes: [
        { fields: ['patient_profile_id'] },
        { fields: ['market_id'] },
        { fields: ['shopping_list_id'] },
        { fields: ['purchased_at'] },
      ],
    },
  );

  PurchaseHistory.associate = (models) => {
    PurchaseHistory.belongsTo(models.PatientProfile, { as: 'patient', foreignKey: 'patientProfileId', onDelete: 'CASCADE' });
    PurchaseHistory.belongsTo(models.ShoppingList, { as: 'list', foreignKey: 'shoppingListId', onDelete: 'SET NULL' });
    PurchaseHistory.belongsTo(models.Market, { as: 'market', foreignKey: 'marketId', onDelete: 'SET NULL' });
    PurchaseHistory.hasMany(models.PurchaseItemDetail, { as: 'items', foreignKey: 'purchaseHistoryId', onDelete: 'CASCADE' });
  };

  return PurchaseHistory;
};
