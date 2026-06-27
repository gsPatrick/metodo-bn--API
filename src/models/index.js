// src/models/index.js — inicializa o Sequelize, carrega todos os models do
// diretório e resolve as associações de forma limpa.
//
// Cada arquivo de model exporta uma factory: (sequelize, DataTypes) => Model
// e, opcionalmente, uma função estática `associate(models)`.
const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const basename = path.basename(__filename);
const db = {};

// Carrega dinamicamente todos os arquivos .js da pasta (exceto este index).
fs.readdirSync(__dirname)
  .filter(
    (file) =>
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js' &&
      !file.endsWith('.test.js'),
  )
  .forEach((file) => {
    const modelFactory = require(path.join(__dirname, file));
    const model = modelFactory(sequelize, DataTypes);
    db[model.name] = model;
  });

// Resolve as associações depois que todos os models estão registrados.
Object.keys(db).forEach((modelName) => {
  if (typeof db[modelName].associate === 'function') {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
