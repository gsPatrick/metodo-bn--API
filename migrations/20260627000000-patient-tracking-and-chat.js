'use strict';

// Migration — fechar o ciclo nutri <-> paciente:
//   - daily_health_metrics.trained_today (treino do dia, gamificação)
//   - meal_logs        (consumo diário dos itens do plano)
//   - meal_extras      ("comeu a mais" fora do plano)
//   - conversations    (chat 1:1 nutri/paciente)
//   - messages         (mensagens + anexos)
//   - reminders        (lembretes do paciente)
//   - patient_achievements (conquistas/badges)
// Depende de: users, patient_profiles, meals, meal_items, foods.

const idCol = (Sequelize) => ({
  type: Sequelize.UUID,
  allowNull: false,
  primaryKey: true,
  defaultValue: Sequelize.literal('gen_random_uuid()'),
});

const fk = (Sequelize, table, allowNull = false, onDelete = 'CASCADE') => ({
  type: Sequelize.UUID,
  allowNull,
  references: { model: table, key: 'id' },
  onDelete,
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

      // -------- daily_health_metrics.trained_today --------
      await queryInterface.addColumn('daily_health_metrics', 'trained_today', { type: DataTypes.BOOLEAN, allowNull: true }, t);

      // ---------------------------------------------------- meal_logs
      await queryInterface.createTable(
        'meal_logs',
        {
          id: idCol(Sequelize),
          patient_profile_id: fk(Sequelize, 'patient_profiles'),
          date: { type: DataTypes.DATEONLY, allowNull: false },
          meal_item_id: fk(Sequelize, 'meal_items'),
          status: { type: DataTypes.STRING(20), allowNull: false },
          swapped_food_id: fk(Sequelize, 'foods', true, 'SET NULL'),
          swapped_food_name: { type: DataTypes.STRING(160), allowNull: true },
          ...timestamps(Sequelize),
        },
        t,
      );
      await queryInterface.addIndex('meal_logs', ['patient_profile_id'], { transaction });
      await queryInterface.addIndex('meal_logs', ['date'], { transaction });
      await queryInterface.addIndex('meal_logs', ['patient_profile_id', 'date', 'meal_item_id'], {
        unique: true,
        transaction,
        name: 'meal_logs_unique_per_day_item',
      });

      // ---------------------------------------------------- meal_extras
      await queryInterface.createTable(
        'meal_extras',
        {
          id: idCol(Sequelize),
          patient_profile_id: fk(Sequelize, 'patient_profiles'),
          date: { type: DataTypes.DATEONLY, allowNull: false },
          meal_id: fk(Sequelize, 'meals', true, 'SET NULL'),
          food_id: fk(Sequelize, 'foods', true, 'SET NULL'),
          food_name: { type: DataTypes.STRING(160), allowNull: false },
          quantity_g: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
          kcal: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
          carbs_g: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
          protein_g: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
          fat_g: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
          ...timestamps(Sequelize),
        },
        t,
      );
      await queryInterface.addIndex('meal_extras', ['patient_profile_id', 'date'], { transaction });

      // ---------------------------------------------------- conversations
      await queryInterface.createTable(
        'conversations',
        {
          id: idCol(Sequelize),
          nutritionist_id: fk(Sequelize, 'users'),
          patient_profile_id: fk(Sequelize, 'patient_profiles'),
          last_message_at: { type: DataTypes.DATE, allowNull: true },
          last_message_preview: { type: DataTypes.STRING(160), allowNull: true },
          nutri_unread: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
          patient_unread: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
          ...timestamps(Sequelize),
        },
        t,
      );
      await queryInterface.addIndex('conversations', ['nutritionist_id'], { transaction });
      await queryInterface.addIndex('conversations', ['patient_profile_id'], { transaction });
      await queryInterface.addIndex('conversations', ['nutritionist_id', 'patient_profile_id'], {
        unique: true,
        transaction,
        name: 'conversations_unique_pair',
      });

      // ---------------------------------------------------- messages
      await queryInterface.createTable(
        'messages',
        {
          id: idCol(Sequelize),
          conversation_id: fk(Sequelize, 'conversations'),
          sender_id: fk(Sequelize, 'users'),
          type: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'text' },
          body: { type: DataTypes.TEXT, allowNull: true },
          attachment_url: { type: DataTypes.TEXT, allowNull: true },
          attachment_name: { type: DataTypes.STRING(200), allowNull: true },
          attachment_size: { type: DataTypes.STRING(40), allowNull: true },
          duration_sec: { type: DataTypes.INTEGER, allowNull: true },
          read_at: { type: DataTypes.DATE, allowNull: true },
          ...timestamps(Sequelize),
        },
        t,
      );
      await queryInterface.addIndex('messages', ['conversation_id', 'created_at'], { transaction });

      // ---------------------------------------------------- reminders
      await queryInterface.createTable(
        'reminders',
        {
          id: idCol(Sequelize),
          patient_profile_id: fk(Sequelize, 'patient_profiles'),
          type: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'custom' },
          title: { type: DataTypes.STRING(120), allowNull: false },
          time_of_day: { type: DataTypes.TIME, allowNull: true },
          enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
          ...timestamps(Sequelize),
        },
        t,
      );
      await queryInterface.addIndex('reminders', ['patient_profile_id'], { transaction });

      // ---------------------------------------------------- patient_achievements
      await queryInterface.createTable(
        'patient_achievements',
        {
          id: idCol(Sequelize),
          patient_profile_id: fk(Sequelize, 'patient_profiles'),
          code: { type: DataTypes.STRING(40), allowNull: false },
          unlocked_at: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
          ...timestamps(Sequelize),
        },
        t,
      );
      await queryInterface.addIndex('patient_achievements', ['patient_profile_id', 'code'], {
        unique: true,
        transaction,
        name: 'patient_achievements_unique',
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const t = { transaction };
      await queryInterface.dropTable('patient_achievements', t);
      await queryInterface.dropTable('reminders', t);
      await queryInterface.dropTable('messages', t);
      await queryInterface.dropTable('conversations', t);
      await queryInterface.dropTable('meal_extras', t);
      await queryInterface.dropTable('meal_logs', t);
      await queryInterface.removeColumn('daily_health_metrics', 'trained_today', t);
    });
  },
};
