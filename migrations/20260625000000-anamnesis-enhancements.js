'use strict';

// Migration — reforços da anamnese:
//   - anamneses.clinical_conditions (condições CLÍNICAS do paciente, estruturadas,
//     usadas pelas regras automáticas por patologia)
//   - patient_restrictions.source (origem: 'manual' | 'anamnesis') para sincronizar
//     alergias/intolerâncias da anamnese sem sobrescrever as manuais.
// Depende de `anamneses` e `patient_restrictions`.

module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.sequelize.transaction(async (transaction) => {
      const t = { transaction };
      await queryInterface.addColumn(
        'anamneses',
        'clinical_conditions',
        { type: DataTypes.JSONB, allowNull: true },
        t,
      );
      await queryInterface.addColumn(
        'patient_restrictions',
        'source',
        { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'manual' },
        t,
      );
      await queryInterface.addIndex('patient_restrictions', ['source'], {
        transaction,
        name: 'patient_restrictions_source_idx',
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const t = { transaction };
      await queryInterface.removeIndex('patient_restrictions', 'patient_restrictions_source_idx', t);
      await queryInterface.removeColumn('patient_restrictions', 'source', t);
      await queryInterface.removeColumn('anamneses', 'clinical_conditions', t);
    });
  },
};
