// src/models/shopping-list.js — lista de compras agregada do paciente.
const { SHOPPING_LIST_STATUS, values } = require('../config/constants');

module.exports = (sequelize, DataTypes) => {
  const ShoppingList = sequelize.define(
    'ShoppingList',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      patientProfileId: { type: DataTypes.UUID, allowNull: false },
      // Origem opcional: lista gerada a partir de um plano alimentar.
      dietPlanId: { type: DataTypes.UUID, allowNull: true },
      title: { type: DataTypes.STRING(160), allowNull: false, defaultValue: 'Lista de compras' },
      status: {
        type: DataTypes.ENUM(...values(SHOPPING_LIST_STATUS)),
        allowNull: false,
        defaultValue: SHOPPING_LIST_STATUS.ACTIVE,
      },
      // Orçamento desta sessão de compra (opcional). Se nulo, usa o teto do
      // perfil do paciente (shopping_budget) no Modo Compra.
      budget: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      completedAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: 'shopping_lists',
      indexes: [
        { fields: ['patient_profile_id'] },
        { fields: ['diet_plan_id'] },
        { fields: ['status'] },
      ],
    },
  );

  ShoppingList.associate = (models) => {
    ShoppingList.belongsTo(models.PatientProfile, { as: 'patient', foreignKey: 'patientProfileId', onDelete: 'CASCADE' });
    ShoppingList.belongsTo(models.DietPlan, { as: 'dietPlan', foreignKey: 'dietPlanId', onDelete: 'SET NULL' });
    ShoppingList.hasMany(models.ShoppingListItem, { as: 'items', foreignKey: 'shoppingListId', onDelete: 'CASCADE' });
    ShoppingList.hasOne(models.PurchaseHistory, { as: 'purchase', foreignKey: 'shoppingListId', onDelete: 'SET NULL' });
  };

  return ShoppingList;
};
