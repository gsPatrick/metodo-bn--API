// src/models/anamnesis.js — prontuário de Anamnese Nutricional (Adulto).
// Espelha o formulário clínico completo: blocos qualitativos em JSONB (flexível e
// extensível) + restrições clínicas ESTRUTURADAS (alergias/intolerâncias/aversões/
// preferências) que são a "regra de ouro" usada na geração de dietas.
// 1:1 com PatientProfile (um prontuário-mestre por paciente, atualizado ao longo do tempo).
module.exports = (sequelize, DataTypes) => {
  const Anamnesis = sequelize.define(
    'Anamnesis',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      patientProfileId: { type: DataTypes.UUID, allowNull: false, unique: true },
      nutritionistId: { type: DataTypes.UUID, allowNull: true },

      // Informações gerais: situação conjugal, religião, naturalidade, procedência,
      // motivo da consulta/queixa principal, ocupação, carga horária, nome da mãe.
      generalInfo: { type: DataTypes.JSONB, allowNull: true },
      // Condições socioeconômicas: renda familiar, renda p/ alimentação, habitação,
      // animais de estimação, com quem reside.
      socioeconomic: { type: DataTypes.JSONB, allowNull: true },
      // Estilo de vida: sono, etilismo, tabagismo, disposição, memória, concentração,
      // exercício físico (tipo/intensidade/frequência/horário/duração).
      lifestyle: { type: DataTypes.JSONB, allowNull: true },
      // Atividade física diária: tempo de tela, tempo sentado, deslocamento, tarefas
      // domésticas, uso de escadas (valor/frequência/horário).
      dailyActivity: { type: DataTypes.JSONB, allowNull: true },
      // Reprodução: gestações, abortos, ciclo menstrual, fluxo, cólica, TPM.
      reproduction: { type: DataTypes.JSONB, allowNull: true },
      // História patológica familiar: obesidade, DM, HAS, AVC, câncer, dislipidemia,
      // cardiopatia, outros.
      familyHistory: { type: DataTypes.JSONB, allowNull: true },

      pathologyPast: { type: DataTypes.TEXT, allowNull: true }, // história patológica pregressa
      pathologyCurrent: { type: DataTypes.TEXT, allowNull: true }, // história patológica atual
      medicationsSupplements: { type: DataTypes.TEXT, allowNull: true }, // medicamentos/suplementos em uso

      // História nutricional: aparelho GI (sintomas + alimentos), ritmo intestinal/urinário.
      gastrointestinal: { type: DataTypes.JSONB, allowNull: true },
      intestinalRhythm: { type: DataTypes.JSONB, allowNull: true },
      urinaryRhythm: { type: DataTypes.JSONB, allowNull: true },
      // Hábitos alimentares: apetite, mastigação, motivos.
      eatingHabits: { type: DataTypes.JSONB, allowNull: true },
      // Condições clínicas ATUAIS do paciente (estruturadas) — base das regras
      // automáticas por patologia (HAS→sódio, DM→carbo, etc.).
      // Ex.: { hypertension: true, diabetes: false, dyslipidemia: true, ... }
      clinicalConditions: { type: DataTypes.JSONB, allowNull: true },

      // --- REGRA DE OURO: restrições clínicas estruturadas (arrays de string) ---
      allergies: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      intolerances: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      aversions: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      preferences: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },

      // Exame físico/semiologia: cabelos, mucosas, lábios, língua, dentição, pele,
      // unhas, abdômen, edema.
      physicalExam: { type: DataTypes.JSONB, allowNull: true },
      // Frequência alimentar: mapa alimento->frequência + tipo de óleo, gordura visível,
      // pele do frango, sal depois de pronto.
      foodFrequency: { type: DataTypes.JSONB, allowNull: true },
      // Recordatório alimentar habitual: refeições, finais de semana, líquidos na refeição.
      dietaryRecall: { type: DataTypes.JSONB, allowNull: true },
      // Ingestão hídrica diária (ml) — extraída para uso direto em cálculos.
      waterIntakeMl: { type: DataTypes.INTEGER, allowNull: true },

      diagnosis: { type: DataTypes.TEXT, allowNull: true }, // diagnóstico nutricional
      objectives: { type: DataTypes.TEXT, allowNull: true }, // objetivos da intervenção

      status: {
        type: DataTypes.ENUM('draft', 'completed'),
        allowNull: false,
        defaultValue: 'draft',
      },
    },
    {
      tableName: 'anamneses',
      indexes: [
        { unique: true, fields: ['patient_profile_id'] },
        { fields: ['nutritionist_id'] },
        { fields: ['status'] },
      ],
    },
  );

  Anamnesis.associate = (models) => {
    Anamnesis.belongsTo(models.PatientProfile, { as: 'patient', foreignKey: 'patientProfileId', onDelete: 'CASCADE' });
    Anamnesis.belongsTo(models.User, { as: 'nutritionist', foreignKey: 'nutritionistId', onDelete: 'SET NULL' });
  };

  return Anamnesis;
};
