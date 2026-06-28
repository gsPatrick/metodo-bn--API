// src/models/user.js — entidade central de identidade e RBAC.
const bcrypt = require('bcryptjs');
const { ROLES, values } = require('../config/constants');

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    'User',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      // Email OU telefone identificam a conta — ambos opcionais, ao menos um exigido no service.
      email: {
        type: DataTypes.STRING(180),
        allowNull: true,
        unique: true,
        validate: { isEmail: true },
      },
      // Hash gerado nos hooks; nunca armazenar texto puro.
      passwordHash: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      role: {
        type: DataTypes.ENUM(...values(ROLES)),
        allowNull: false,
        defaultValue: ROLES.PATIENT,
      },
      phone: {
        type: DataTypes.STRING(30),
        allowNull: true,
        unique: true,
      },
      // Flag de status ativo/inativo (moderação / soft-disable).
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      lastLoginAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'users',
      indexes: [
        { unique: true, fields: ['email'] },
        { unique: true, fields: ['phone'] },
        { fields: ['role'] },
        { fields: ['is_active'] },
      ],
      defaultScope: {
        // Nunca devolver o hash por padrão nas queries.
        attributes: { exclude: ['passwordHash'] },
      },
      scopes: {
        withPassword: { attributes: {} },
      },
    },
  );

  // Helper de virtual setter: aceita senha em texto e gera o hash.
  User.prototype.setPassword = async function setPassword(plain) {
    this.passwordHash = await bcrypt.hash(plain, 10);
  };

  User.prototype.validatePassword = function validatePassword(plain) {
    return bcrypt.compare(plain, this.passwordHash);
  };

  User.associate = (models) => {
    // Um nutricionista possui muitos perfis de paciente (via nutritionist_id).
    User.hasMany(models.PatientProfile, {
      as: 'patients',
      foreignKey: 'nutritionistId',
      onDelete: 'CASCADE',
    });
    // Um usuário paciente tem um perfil clínico (1:1).
    User.hasOne(models.PatientProfile, {
      as: 'profile',
      foreignKey: 'userId',
      onDelete: 'CASCADE',
    });

    User.hasMany(models.Notification, { as: 'notifications', foreignKey: 'userId', onDelete: 'CASCADE' });
    User.hasMany(models.DeviceToken, { as: 'deviceTokens', foreignKey: 'userId', onDelete: 'CASCADE' });
    User.hasMany(models.WebSocketConnection, { as: 'connections', foreignKey: 'userId', onDelete: 'CASCADE' });
    User.hasMany(models.RefreshToken, { as: 'refreshTokens', foreignKey: 'userId', onDelete: 'CASCADE' });
    User.hasMany(models.PasswordResetToken, { as: 'passwordResetTokens', foreignKey: 'userId', onDelete: 'CASCADE' });

    User.hasMany(models.Food, { as: 'customFoods', foreignKey: 'createdByNutritionistId', onDelete: 'CASCADE' });
    User.hasOne(models.MonetizationConfig, { as: 'monetizationConfig', foreignKey: 'nutritionistId', onDelete: 'CASCADE' });
    User.hasMany(models.PaymentPlan, { as: 'paymentPlans', foreignKey: 'nutritionistId', onDelete: 'CASCADE' });
    User.hasMany(models.MealTemplate, { as: 'mealTemplates', foreignKey: 'nutritionistId', onDelete: 'CASCADE' });
  };

  return User;
};
