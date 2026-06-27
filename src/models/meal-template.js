// src/models/meal-template.js — modelos de refeição reutilizáveis ("pratos prontos").
// A nutricionista salva combinações frequentes (ex: "Arroz, Feijão, Frango e Salada")
// para inserir rapidamente em planos. Macros totais pré-computados para leitura rápida.
module.exports = (sequelize, DataTypes) => {
  const MealTemplate = sequelize.define(
    'MealTemplate',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      nutritionistId: { type: DataTypes.UUID, allowNull: false },
      name: { type: DataTypes.STRING(160), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      // Horário sugerido (apenas hora).
      preferredTime: { type: DataTypes.TIME, allowNull: true },

      // Cache pré-computado dos macros do prato completo (soma dos itens).
      totalKcal: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
      totalCarbsG: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
      totalProteinG: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
      totalFatG: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },

      usageCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: 'meal_templates',
      indexes: [
        { fields: ['nutritionist_id'] },
        { fields: ['name'] },
        { fields: ['usage_count'] },
      ],
    },
  );

  MealTemplate.associate = (models) => {
    MealTemplate.belongsTo(models.User, { as: 'nutritionist', foreignKey: 'nutritionistId', onDelete: 'CASCADE' });
    MealTemplate.hasMany(models.MealTemplateItem, { as: 'items', foreignKey: 'mealTemplateId', onDelete: 'CASCADE' });
  };

  return MealTemplate;
};
