// src/models/shopping-list-item.js — item individual da lista (checklist + preço).
module.exports = (sequelize, DataTypes) => {
  const ShoppingListItem = sequelize.define(
    'ShoppingListItem',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      shoppingListId: { type: DataTypes.UUID, allowNull: false },
      // Referência opcional ao catálogo de alimentos.
      foodId: { type: DataTypes.UUID, allowNull: true },
      name: { type: DataTypes.STRING(180), allowNull: false },
      // Categoria de gôndola: Hortifruti, Laticínios, etc.
      category: { type: DataTypes.STRING(80), allowNull: true },
      quantity: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 1 },
      unit: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'un' },
      // Estado do checklist no app.
      isChecked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      // Preço preenchido no "Modo Compra".
      price: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    },
    {
      tableName: 'shopping_list_items',
      indexes: [
        { fields: ['shopping_list_id'] },
        { fields: ['food_id'] },
        { fields: ['category'] },
        { fields: ['is_checked'] },
      ],
    },
  );

  ShoppingListItem.associate = (models) => {
    ShoppingListItem.belongsTo(models.ShoppingList, { as: 'list', foreignKey: 'shoppingListId', onDelete: 'CASCADE' });
    ShoppingListItem.belongsTo(models.Food, { as: 'food', foreignKey: 'foodId', onDelete: 'SET NULL' });
  };

  return ShoppingListItem;
};
