// src/models/market.js — cadastro de mercados com geolocalização precisa.
// latitude/longitude em DECIMAL de alta precisão para buscas espaciais.
module.exports = (sequelize, DataTypes) => {
  const Market = sequelize.define(
    'Market',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: { type: DataTypes.STRING(180), allowNull: false },
      address: { type: DataTypes.STRING(255), allowNull: true },
      city: { type: DataTypes.STRING(120), allowNull: true },
      state: { type: DataTypes.STRING(60), allowNull: true },
      // Coordenadas exatas — DECIMAL(10,7) cobre ~1cm de precisão.
      latitude: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
      longitude: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: 'markets',
      indexes: [
        { fields: ['name'] },
        // Índice composto para filtros espaciais por bounding box.
        { fields: ['latitude', 'longitude'] },
        { fields: ['city'] },
      ],
    },
  );

  Market.associate = (models) => {
    Market.hasMany(models.PurchaseHistory, { as: 'purchases', foreignKey: 'marketId', onDelete: 'SET NULL' });
  };

  return Market;
};
