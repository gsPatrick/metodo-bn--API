'use strict';

// Migration — tabelas de sessão/auth: refresh_tokens e password_reset_tokens.
// Depende de `users` (criada na migration inicial).

const idCol = (Sequelize) => ({
  type: Sequelize.UUID,
  allowNull: false,
  primaryKey: true,
  defaultValue: Sequelize.literal('gen_random_uuid()'),
});

const fkUser = (Sequelize) => ({
  type: Sequelize.UUID,
  allowNull: false,
  references: { model: 'users', key: 'id' },
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

const timestamps = (Sequelize) => ({
  created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
  updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
});

module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;

    await queryInterface.sequelize.transaction(async (transaction) => {
      const t = { transaction };

      // ---------------------------------------------------------- refresh_tokens
      await queryInterface.createTable(
        'refresh_tokens',
        {
          id: idCol(Sequelize),
          user_id: fkUser(Sequelize),
          token_hash: { type: DataTypes.STRING(128), allowNull: false, unique: true },
          expires_at: { type: DataTypes.DATE, allowNull: false },
          revoked_at: { type: DataTypes.DATE, allowNull: true },
          replaced_by_token_hash: { type: DataTypes.STRING(128), allowNull: true },
          user_agent: { type: DataTypes.STRING, allowNull: true },
          ip_address: { type: DataTypes.STRING(64), allowNull: true },
          ...timestamps(Sequelize),
        },
        t,
      );

      // --------------------------------------------------- password_reset_tokens
      await queryInterface.createTable(
        'password_reset_tokens',
        {
          id: idCol(Sequelize),
          user_id: fkUser(Sequelize),
          token_hash: { type: DataTypes.STRING(128), allowNull: false, unique: true },
          expires_at: { type: DataTypes.DATE, allowNull: false },
          used_at: { type: DataTypes.DATE, allowNull: true },
          ...timestamps(Sequelize),
        },
        t,
      );

      const idx = (table, fields, options = {}) =>
        queryInterface.addIndex(table, fields, { transaction, ...options });

      await idx('refresh_tokens', ['user_id']);
      await idx('refresh_tokens', ['expires_at']);
      await idx('password_reset_tokens', ['user_id']);
      await idx('password_reset_tokens', ['expires_at']);
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const t = { transaction };
      await queryInterface.dropTable('password_reset_tokens', t);
      await queryInterface.dropTable('refresh_tokens', t);
    });
  },
};
