'use strict';

// Migration — Anamnese Nutricional e registros clínicos longitudinais:
//   anamneses, anthropometric_assessments, biochemical_exams, nutritional_evolutions.
// Depende de `patient_profiles` e `users` (migration inicial).

const idCol = (Sequelize) => ({
  type: Sequelize.UUID,
  allowNull: false,
  primaryKey: true,
  defaultValue: Sequelize.literal('gen_random_uuid()'),
});

const fkPatient = (Sequelize) => ({
  type: Sequelize.UUID,
  allowNull: false,
  references: { model: 'patient_profiles', key: 'id' },
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

const fkNutri = (Sequelize) => ({
  type: Sequelize.UUID,
  allowNull: true,
  references: { model: 'users', key: 'id' },
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
});

const timestamps = (Sequelize) => ({
  created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
  updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
});

const ENUM_TYPES = ['enum_anamneses_status'];

module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.sequelize.transaction(async (transaction) => {
      const t = { transaction };

      // ------------------------------------------------------------- anamneses
      await queryInterface.createTable(
        'anamneses',
        {
          id: idCol(Sequelize),
          patient_profile_id: { ...fkPatient(Sequelize), unique: true },
          nutritionist_id: fkNutri(Sequelize),

          general_info: { type: DataTypes.JSONB, allowNull: true },
          socioeconomic: { type: DataTypes.JSONB, allowNull: true },
          lifestyle: { type: DataTypes.JSONB, allowNull: true },
          daily_activity: { type: DataTypes.JSONB, allowNull: true },
          reproduction: { type: DataTypes.JSONB, allowNull: true },
          family_history: { type: DataTypes.JSONB, allowNull: true },

          pathology_past: { type: DataTypes.TEXT, allowNull: true },
          pathology_current: { type: DataTypes.TEXT, allowNull: true },
          medications_supplements: { type: DataTypes.TEXT, allowNull: true },

          gastrointestinal: { type: DataTypes.JSONB, allowNull: true },
          intestinal_rhythm: { type: DataTypes.JSONB, allowNull: true },
          urinary_rhythm: { type: DataTypes.JSONB, allowNull: true },
          eating_habits: { type: DataTypes.JSONB, allowNull: true },

          allergies: { type: DataTypes.JSONB, allowNull: false, defaultValue: Sequelize.literal("'[]'::jsonb") },
          intolerances: { type: DataTypes.JSONB, allowNull: false, defaultValue: Sequelize.literal("'[]'::jsonb") },
          aversions: { type: DataTypes.JSONB, allowNull: false, defaultValue: Sequelize.literal("'[]'::jsonb") },
          preferences: { type: DataTypes.JSONB, allowNull: false, defaultValue: Sequelize.literal("'[]'::jsonb") },

          physical_exam: { type: DataTypes.JSONB, allowNull: true },
          food_frequency: { type: DataTypes.JSONB, allowNull: true },
          dietary_recall: { type: DataTypes.JSONB, allowNull: true },
          water_intake_ml: { type: DataTypes.INTEGER, allowNull: true },

          diagnosis: { type: DataTypes.TEXT, allowNull: true },
          objectives: { type: DataTypes.TEXT, allowNull: true },
          status: { type: DataTypes.ENUM('draft', 'completed'), allowNull: false, defaultValue: 'draft' },
          ...timestamps(Sequelize),
        },
        t,
      );

      // ------------------------------------------- anthropometric_assessments
      await queryInterface.createTable(
        'anthropometric_assessments',
        {
          id: idCol(Sequelize),
          patient_profile_id: fkPatient(Sequelize),
          nutritionist_id: fkNutri(Sequelize),
          date: { type: DataTypes.DATEONLY, allowNull: false },
          height_cm: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
          weight_usual_kg: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
          weight_current_kg: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
          imc: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
          body_fat_percent: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
          circumferences: { type: DataTypes.JSONB, allowNull: true },
          skinfolds: { type: DataTypes.JSONB, allowNull: true },
          derived: { type: DataTypes.JSONB, allowNull: true },
          notes: { type: DataTypes.TEXT, allowNull: true },
          ...timestamps(Sequelize),
        },
        t,
      );

      // ------------------------------------------------------- biochemical_exams
      await queryInterface.createTable(
        'biochemical_exams',
        {
          id: idCol(Sequelize),
          patient_profile_id: fkPatient(Sequelize),
          date: { type: DataTypes.DATEONLY, allowNull: true },
          laboratory: { type: DataTypes.STRING(160), allowNull: true },
          results: { type: DataTypes.JSONB, allowNull: true },
          other_exams: { type: DataTypes.TEXT, allowNull: true },
          ...timestamps(Sequelize),
        },
        t,
      );

      // --------------------------------------------------- nutritional_evolutions
      await queryInterface.createTable(
        'nutritional_evolutions',
        {
          id: idCol(Sequelize),
          patient_profile_id: fkPatient(Sequelize),
          nutritionist_id: fkNutri(Sequelize),
          date: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: Sequelize.literal('CURRENT_DATE') },
          notes: { type: DataTypes.TEXT, allowNull: false },
          ...timestamps(Sequelize),
        },
        t,
      );

      const idx = (table, fields, options = {}) =>
        queryInterface.addIndex(table, fields, { transaction, ...options });

      await idx('anamneses', ['nutritionist_id']);
      await idx('anamneses', ['status']);
      await idx('anthropometric_assessments', ['patient_profile_id']);
      await idx('anthropometric_assessments', ['date']);
      await idx('anthropometric_assessments', ['patient_profile_id', 'date']);
      await idx('biochemical_exams', ['patient_profile_id']);
      await idx('biochemical_exams', ['date']);
      await idx('nutritional_evolutions', ['patient_profile_id']);
      await idx('nutritional_evolutions', ['date']);
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const t = { transaction };
      await queryInterface.dropTable('nutritional_evolutions', t);
      await queryInterface.dropTable('biochemical_exams', t);
      await queryInterface.dropTable('anthropometric_assessments', t);
      await queryInterface.dropTable('anamneses', t);
      for (const enumType of ENUM_TYPES) {
        await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "${enumType}";`, t);
      }
    });
  },
};
