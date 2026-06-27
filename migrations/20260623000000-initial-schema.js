'use strict';

// Migration inicial — cria TODO o schema na ordem estrita de dependência das FKs.
// Tudo dentro de uma transação: se qualquer passo falhar, nada é aplicado.
//
// Ordem de criação (pai antes do filho):
//   users
//   -> patient_profiles -> patient_restrictions
//   -> notifications, device_tokens, websocket_connections
//   -> foods
//   -> diet_plans -> meals -> meal_items
//   -> markets
//   -> shopping_lists -> shopping_list_items
//   -> purchase_histories -> purchase_item_details
//   -> monetization_configs, payment_plans
//   -> subscriptions -> payment_transactions
//   -> daily_health_metrics

/** Coluna PK UUID com default a nível de banco (gen_random_uuid, via pgcrypto). */
const idCol = (Sequelize) => ({
  type: Sequelize.UUID,
  allowNull: false,
  primaryKey: true,
  defaultValue: Sequelize.literal('gen_random_uuid()'),
});

/** Coluna de chave estrangeira UUID com integridade referencial. */
const fk = (Sequelize, model, opts = {}) => {
  const { allowNull = false, onDelete = 'CASCADE', unique = false } = opts;
  return {
    type: Sequelize.UUID,
    allowNull,
    unique,
    references: { model, key: 'id' },
    onDelete,
    onUpdate: 'CASCADE',
  };
};

/** created_at / updated_at padronizados (snake_case, underscored). */
const timestamps = (Sequelize) => ({
  created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
  updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
});

// ENUM types criados pelo Sequelize (nomeados enum_<tabela>_<coluna>).
// Listados para limpeza no `down`.
const ENUM_TYPES = [
  'enum_users_role',
  'enum_patient_profiles_sex',
  'enum_patient_profiles_activity_level',
  'enum_patient_profiles_goal',
  'enum_patient_restrictions_type',
  'enum_notifications_type',
  'enum_device_tokens_platform',
  'enum_diet_plans_status',
  'enum_shopping_lists_status',
  'enum_subscriptions_status',
  'enum_payment_transactions_method',
  'enum_payment_transactions_status',
];

module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;

    await queryInterface.sequelize.transaction(async (transaction) => {
      const t = { transaction };

      // Extensão necessária para gen_random_uuid() como default de PK.
      await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";', t);

      // ----------------------------------------------------------------- users
      await queryInterface.createTable(
        'users',
        {
          id: idCol(Sequelize),
          name: { type: DataTypes.STRING(150), allowNull: false },
          email: { type: DataTypes.STRING(180), allowNull: false, unique: true },
          password_hash: { type: DataTypes.STRING, allowNull: false },
          role: {
            type: DataTypes.ENUM('admin', 'nutritionist', 'patient'),
            allowNull: false,
            defaultValue: 'patient',
          },
          phone: { type: DataTypes.STRING(30), allowNull: true },
          is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
          last_login_at: { type: DataTypes.DATE, allowNull: true },
          ...timestamps(Sequelize),
        },
        t,
      );

      // ------------------------------------------------------- patient_profiles
      await queryInterface.createTable(
        'patient_profiles',
        {
          id: idCol(Sequelize),
          user_id: fk(Sequelize, 'users', { unique: true }),
          nutritionist_id: fk(Sequelize, 'users'),
          birth_date: { type: DataTypes.DATEONLY, allowNull: true },
          sex: { type: DataTypes.ENUM('male', 'female', 'other'), allowNull: true },
          height_cm: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
          weight_kg: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
          activity_level: {
            type: DataTypes.ENUM('sedentary', 'light', 'moderate', 'active', 'very_active'),
            allowNull: true,
            defaultValue: 'sedentary',
          },
          goal: {
            type: DataTypes.ENUM('lose_weight', 'maintain', 'gain_muscle'),
            allowNull: true,
            defaultValue: 'maintain',
          },
          clinical_notes: { type: DataTypes.TEXT, allowNull: true },
          ...timestamps(Sequelize),
        },
        t,
      );

      // --------------------------------------------------- patient_restrictions
      await queryInterface.createTable(
        'patient_restrictions',
        {
          id: idCol(Sequelize),
          patient_profile_id: fk(Sequelize, 'patient_profiles'),
          type: {
            type: DataTypes.ENUM('allergy', 'intolerance', 'preference'),
            allowNull: false,
            defaultValue: 'preference',
          },
          label: { type: DataTypes.STRING(120), allowNull: false },
          notes: { type: DataTypes.TEXT, allowNull: true },
          ...timestamps(Sequelize),
        },
        t,
      );

      // --------------------------------------------------------- notifications
      await queryInterface.createTable(
        'notifications',
        {
          id: idCol(Sequelize),
          user_id: fk(Sequelize, 'users'),
          title: { type: DataTypes.STRING(160), allowNull: false },
          message: { type: DataTypes.TEXT, allowNull: false },
          type: {
            type: DataTypes.ENUM(
              'diet_approved',
              'budget_warning',
              'payment_success',
              'payment_failed',
              'new_message',
              'system_alert',
            ),
            allowNull: false,
            defaultValue: 'system_alert',
          },
          is_read: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
          read_at: { type: DataTypes.DATE, allowNull: true },
          metadata: { type: DataTypes.JSONB, allowNull: true },
          ...timestamps(Sequelize),
        },
        t,
      );

      // ---------------------------------------------------------- device_tokens
      await queryInterface.createTable(
        'device_tokens',
        {
          id: idCol(Sequelize),
          user_id: fk(Sequelize, 'users'),
          token: { type: DataTypes.STRING, allowNull: false, unique: true },
          platform: { type: DataTypes.ENUM('ios', 'android', 'web'), allowNull: false },
          is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
          last_used_at: { type: DataTypes.DATE, allowNull: true },
          ...timestamps(Sequelize),
        },
        t,
      );

      // -------------------------------------------------- websocket_connections
      await queryInterface.createTable(
        'websocket_connections',
        {
          id: idCol(Sequelize),
          user_id: fk(Sequelize, 'users'),
          socket_id: { type: DataTypes.STRING, allowNull: false, unique: true },
          connected_at: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
          disconnected_at: { type: DataTypes.DATE, allowNull: true },
          is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
          ...timestamps(Sequelize),
        },
        t,
      );

      // ------------------------------------------------------------------ foods
      await queryInterface.createTable(
        'foods',
        {
          id: idCol(Sequelize),
          name: { type: DataTypes.STRING(180), allowNull: false },
          source: { type: DataTypes.STRING(40), allowNull: true, defaultValue: 'TACO' },
          category: { type: DataTypes.STRING(80), allowNull: true },
          kcal: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
          carbs_g: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
          protein_g: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
          fat_g: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
          fiber_g: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
          sodium_mg: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
          is_custom: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
          created_by_nutritionist_id: fk(Sequelize, 'users', { allowNull: true }),
          is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
          ...timestamps(Sequelize),
        },
        t,
      );

      // ------------------------------------------------------------- diet_plans
      await queryInterface.createTable(
        'diet_plans',
        {
          id: idCol(Sequelize),
          patient_profile_id: fk(Sequelize, 'patient_profiles'),
          nutritionist_id: fk(Sequelize, 'users'),
          title: { type: DataTypes.STRING(160), allowNull: false },
          description: { type: DataTypes.TEXT, allowNull: true },
          target_kcal: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
          target_carbs_g: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
          target_protein_g: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
          target_fat_g: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
          status: { type: DataTypes.ENUM('draft', 'approved'), allowNull: false, defaultValue: 'draft' },
          approved_at: { type: DataTypes.DATE, allowNull: true },
          start_date: { type: DataTypes.DATEONLY, allowNull: true },
          end_date: { type: DataTypes.DATEONLY, allowNull: true },
          ...timestamps(Sequelize),
        },
        t,
      );

      // ------------------------------------------------------------------ meals
      await queryInterface.createTable(
        'meals',
        {
          id: idCol(Sequelize),
          diet_plan_id: fk(Sequelize, 'diet_plans'),
          name: { type: DataTypes.STRING(120), allowNull: false },
          sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
          preferred_time: { type: DataTypes.TIME, allowNull: true },
          notes: { type: DataTypes.TEXT, allowNull: true },
          ...timestamps(Sequelize),
        },
        t,
      );

      // ------------------------------------------------------------- meal_items
      await queryInterface.createTable(
        'meal_items',
        {
          id: idCol(Sequelize),
          meal_id: fk(Sequelize, 'meals'),
          food_id: fk(Sequelize, 'foods', { allowNull: true, onDelete: 'SET NULL' }),
          custom_food_name: { type: DataTypes.STRING(180), allowNull: true },
          quantity: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
          unit: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'g' },
          sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
          notes: { type: DataTypes.TEXT, allowNull: true },
          ...timestamps(Sequelize),
        },
        t,
      );

      // ---------------------------------------------------------------- markets
      await queryInterface.createTable(
        'markets',
        {
          id: idCol(Sequelize),
          name: { type: DataTypes.STRING(180), allowNull: false },
          address: { type: DataTypes.STRING(255), allowNull: true },
          city: { type: DataTypes.STRING(120), allowNull: true },
          state: { type: DataTypes.STRING(60), allowNull: true },
          latitude: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
          longitude: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
          is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
          ...timestamps(Sequelize),
        },
        t,
      );

      // --------------------------------------------------------- shopping_lists
      await queryInterface.createTable(
        'shopping_lists',
        {
          id: idCol(Sequelize),
          patient_profile_id: fk(Sequelize, 'patient_profiles'),
          diet_plan_id: fk(Sequelize, 'diet_plans', { allowNull: true, onDelete: 'SET NULL' }),
          title: { type: DataTypes.STRING(160), allowNull: false, defaultValue: 'Lista de compras' },
          status: {
            type: DataTypes.ENUM('active', 'completed', 'archived'),
            allowNull: false,
            defaultValue: 'active',
          },
          completed_at: { type: DataTypes.DATE, allowNull: true },
          ...timestamps(Sequelize),
        },
        t,
      );

      // ---------------------------------------------------- shopping_list_items
      await queryInterface.createTable(
        'shopping_list_items',
        {
          id: idCol(Sequelize),
          shopping_list_id: fk(Sequelize, 'shopping_lists'),
          food_id: fk(Sequelize, 'foods', { allowNull: true, onDelete: 'SET NULL' }),
          name: { type: DataTypes.STRING(180), allowNull: false },
          category: { type: DataTypes.STRING(80), allowNull: true },
          quantity: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 1 },
          unit: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'un' },
          is_checked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
          price: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
          ...timestamps(Sequelize),
        },
        t,
      );

      // ----------------------------------------------------- purchase_histories
      await queryInterface.createTable(
        'purchase_histories',
        {
          id: idCol(Sequelize),
          patient_profile_id: fk(Sequelize, 'patient_profiles'),
          shopping_list_id: fk(Sequelize, 'shopping_lists', { allowNull: true, onDelete: 'SET NULL' }),
          market_id: fk(Sequelize, 'markets', { allowNull: true, onDelete: 'SET NULL' }),
          total_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
          purchased_at: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
          notes: { type: DataTypes.TEXT, allowNull: true },
          ...timestamps(Sequelize),
        },
        t,
      );

      // -------------------------------------------------- purchase_item_details
      await queryInterface.createTable(
        'purchase_item_details',
        {
          id: idCol(Sequelize),
          purchase_history_id: fk(Sequelize, 'purchase_histories'),
          food_id: fk(Sequelize, 'foods', { allowNull: true, onDelete: 'SET NULL' }),
          name: { type: DataTypes.STRING(180), allowNull: false },
          quantity: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 1 },
          unit: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'un' },
          unit_price: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
          subtotal: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
          ...timestamps(Sequelize),
        },
        t,
      );

      // -------------------------------------------------- monetization_configs
      await queryInterface.createTable(
        'monetization_configs',
        {
          id: idCol(Sequelize),
          nutritionist_id: fk(Sequelize, 'users', { allowNull: true, unique: true }),
          is_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
          gateway_account_id: { type: DataTypes.STRING, allowNull: true },
          notes: { type: DataTypes.TEXT, allowNull: true },
          ...timestamps(Sequelize),
        },
        t,
      );

      // ----------------------------------------------------------- payment_plans
      await queryInterface.createTable(
        'payment_plans',
        {
          id: idCol(Sequelize),
          nutritionist_id: fk(Sequelize, 'users'),
          name: { type: DataTypes.STRING(160), allowNull: false },
          description: { type: DataTypes.TEXT, allowNull: true },
          price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
          cycle_days: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30 },
          currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'BRL' },
          is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
          ...timestamps(Sequelize),
        },
        t,
      );

      // ----------------------------------------------------------- subscriptions
      await queryInterface.createTable(
        'subscriptions',
        {
          id: idCol(Sequelize),
          patient_profile_id: fk(Sequelize, 'patient_profiles'),
          payment_plan_id: fk(Sequelize, 'payment_plans'),
          status: {
            type: DataTypes.ENUM('active', 'past_due', 'canceled'),
            allowNull: false,
            defaultValue: 'active',
          },
          gateway_subscription_id: { type: DataTypes.STRING, allowNull: true },
          gateway_customer_id: { type: DataTypes.STRING, allowNull: true },
          started_at: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
          current_period_end: { type: DataTypes.DATE, allowNull: true },
          canceled_at: { type: DataTypes.DATE, allowNull: true },
          ...timestamps(Sequelize),
        },
        t,
      );

      // ----------------------------------------------------- payment_transactions
      await queryInterface.createTable(
        'payment_transactions',
        {
          id: idCol(Sequelize),
          subscription_id: fk(Sequelize, 'subscriptions'),
          amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
          currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'BRL' },
          method: { type: DataTypes.ENUM('pix', 'boleto', 'credit_card'), allowNull: false },
          status: {
            type: DataTypes.ENUM('pending', 'confirmed', 'received', 'failed', 'refunded'),
            allowNull: false,
            defaultValue: 'pending',
          },
          gateway_transaction_id: { type: DataTypes.STRING, allowNull: true, unique: true },
          gateway_payload: { type: DataTypes.JSONB, allowNull: true },
          paid_at: { type: DataTypes.DATE, allowNull: true },
          ...timestamps(Sequelize),
        },
        t,
      );

      // ---------------------------------------------------- daily_health_metrics
      await queryInterface.createTable(
        'daily_health_metrics',
        {
          id: idCol(Sequelize),
          patient_profile_id: fk(Sequelize, 'patient_profiles'),
          date: { type: DataTypes.DATEONLY, allowNull: false },
          sleep_hours: { type: DataTypes.DECIMAL(4, 2), allowNull: true },
          steps: { type: DataTypes.INTEGER, allowNull: true },
          water_ml: { type: DataTypes.INTEGER, allowNull: true },
          stress_level: { type: DataTypes.INTEGER, allowNull: true },
          diet_adherence: { type: DataTypes.INTEGER, allowNull: true },
          calculated_health_score: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
          ...timestamps(Sequelize),
        },
        t,
      );

      // ===================================================================
      // Índices explícitos (chaves de busca frequentes / espaciais / únicos)
      // Colunas com `unique: true` já geraram índice único próprio.
      // ===================================================================
      const idx = (table, fields, options = {}) =>
        queryInterface.addIndex(table, fields, { transaction, ...options });

      await idx('users', ['role']);
      await idx('users', ['is_active']);

      await idx('patient_profiles', ['nutritionist_id']);

      await idx('patient_restrictions', ['patient_profile_id']);
      await idx('patient_restrictions', ['type']);

      await idx('notifications', ['user_id']);
      await idx('notifications', ['is_read']);
      await idx('notifications', ['type']);
      await idx('notifications', ['user_id', 'is_read', 'created_at']);

      await idx('device_tokens', ['user_id']);
      await idx('device_tokens', ['is_active']);

      await idx('websocket_connections', ['user_id']);
      await idx('websocket_connections', ['is_active']);

      await idx('foods', ['name']);
      await idx('foods', ['category']);
      await idx('foods', ['is_custom']);
      await idx('foods', ['created_by_nutritionist_id']);

      await idx('diet_plans', ['patient_profile_id']);
      await idx('diet_plans', ['nutritionist_id']);
      await idx('diet_plans', ['status']);

      await idx('meals', ['diet_plan_id']);
      await idx('meals', ['diet_plan_id', 'sort_order']);

      await idx('meal_items', ['meal_id']);
      await idx('meal_items', ['food_id']);

      await idx('markets', ['name']);
      await idx('markets', ['latitude', 'longitude']); // filtros espaciais por bounding box
      await idx('markets', ['city']);

      await idx('shopping_lists', ['patient_profile_id']);
      await idx('shopping_lists', ['diet_plan_id']);
      await idx('shopping_lists', ['status']);

      await idx('shopping_list_items', ['shopping_list_id']);
      await idx('shopping_list_items', ['food_id']);
      await idx('shopping_list_items', ['category']);
      await idx('shopping_list_items', ['is_checked']);

      await idx('purchase_histories', ['patient_profile_id']);
      await idx('purchase_histories', ['market_id']);
      await idx('purchase_histories', ['shopping_list_id']);
      await idx('purchase_histories', ['purchased_at']);

      await idx('purchase_item_details', ['purchase_history_id']);
      await idx('purchase_item_details', ['food_id']);
      await idx('purchase_item_details', ['food_id', 'unit_price']); // comparador de preços

      await idx('monetization_configs', ['is_enabled']);

      await idx('payment_plans', ['nutritionist_id']);
      await idx('payment_plans', ['is_active']);

      await idx('subscriptions', ['patient_profile_id']);
      await idx('subscriptions', ['payment_plan_id']);
      await idx('subscriptions', ['status']);
      await idx('subscriptions', ['gateway_subscription_id']);

      await idx('payment_transactions', ['subscription_id']);
      await idx('payment_transactions', ['status']);
      await idx('payment_transactions', ['method']);

      await idx('daily_health_metrics', ['patient_profile_id']);
      await idx('daily_health_metrics', ['date']);
      await idx('daily_health_metrics', ['patient_profile_id', 'date'], {
        unique: true,
        name: 'daily_health_metrics_patient_date_uq',
      });
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const t = { transaction };

      // Drop na ordem INVERSA das FKs (filho antes do pai).
      const tables = [
        'daily_health_metrics',
        'payment_transactions',
        'subscriptions',
        'payment_plans',
        'monetization_configs',
        'purchase_item_details',
        'purchase_histories',
        'shopping_list_items',
        'shopping_lists',
        'markets',
        'meal_items',
        'meals',
        'diet_plans',
        'foods',
        'websocket_connections',
        'device_tokens',
        'notifications',
        'patient_restrictions',
        'patient_profiles',
        'users',
      ];

      for (const table of tables) {
        await queryInterface.dropTable(table, t);
      }

      // Remove os tipos ENUM remanescentes para permitir re-execução limpa.
      for (const enumType of ENUM_TYPES) {
        await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "${enumType}";`, t);
      }
    });
  },
};
