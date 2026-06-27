// src/config/database.js — configuração da conexão Sequelize com PostgreSQL.
// Exporta tanto a instância (usada pelos models) quanto o objeto de config
// usado pelo sequelize-cli (migrations/seeds).
const { Sequelize } = require('sequelize');
const env = require('./env');

const commonOptions = {
  dialect: 'postgres',
  logging: env.NODE_ENV === 'development' ? (msg) => console.log(`[sequelize] ${msg}`) : false,
  define: {
    // Convenções globais aplicadas a todos os models.
    underscored: true, // camelCase no código -> snake_case no banco
    timestamps: true, // created_at / updated_at automáticos
    freezeTableName: false,
  },
  dialectOptions: env.DB_SSL
    ? { ssl: { require: true, rejectUnauthorized: false } }
    : {},
  pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
};

const sequelize = env.DATABASE_URL
  ? new Sequelize(env.DATABASE_URL, commonOptions)
  : new Sequelize(env.DB_NAME, env.DB_USER, env.DB_PASSWORD, {
      host: env.DB_HOST,
      port: env.DB_PORT,
      ...commonOptions,
    });

// Config exportada no formato esperado pelo sequelize-cli (.sequelizerc).
const cliConfig = {
  username: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  host: env.DB_HOST,
  port: env.DB_PORT,
  dialect: 'postgres',
  use_env_variable: env.DATABASE_URL ? 'DATABASE_URL' : undefined,
  dialectOptions: commonOptions.dialectOptions,
  define: commonOptions.define,
};

module.exports = sequelize;
module.exports.sequelize = sequelize;
module.exports.development = cliConfig;
module.exports.test = cliConfig;
module.exports.production = cliConfig;
