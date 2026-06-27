// src/models/purchase-item-detail.js — preço unitário por item em cada compra.
// Fundação para o futuro comparador automático de preços entre mercados.
module.exports = (sequelize, DataTypes) => {
  const PurchaseItemDetail = sequelize.define(
    'PurchaseItemDetail',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      purchaseHistoryId: { type: DataTypes.UUID, allowNull: false },
      // Referência opcional ao catálogo (para comparar o mesmo produto).
      foodId: { type: DataTypes.UUID, allowNull: true },
      name: { type: DataTypes.STRING(180), allowNull: false },
      quantity: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 1 },
      unit: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'un' },
      unitPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      // Subtotal = unitPrice * quantity (persistido para relatórios rápidos).
      subtotal: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    },
    {
      tableName: 'purchase_item_details',
      indexes: [
        { fields: ['purchase_history_id'] },
        { fields: ['food_id'] },
        // Comparador de preços: mesmo produto ao longo do tempo.
        { fields: ['food_id', 'unit_price'] },
      ],
    },
  );

  PurchaseItemDetail.associate = (models) => {
    PurchaseItemDetail.belongsTo(models.PurchaseHistory, { as: 'purchase', foreignKey: 'purchaseHistoryId', onDelete: 'CASCADE' });
    PurchaseItemDetail.belongsTo(models.Food, { as: 'food', foreignKey: 'foodId', onDelete: 'SET NULL' });
  };

  return PurchaseItemDetail;
};
