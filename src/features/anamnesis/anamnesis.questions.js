// src/features/anamnesis/anamnesis.questions.js — catálogo guiado da anamnese.
// Estrutura declarativa que o app usa para renderizar o questionário "pergunta a
// pergunta". Cada campo aponta para o bloco/coluna onde o valor é salvo (mapeando
// para o payload do PUT /anamnesis/:id). Espelha o formulário da clínica-escola.

// type: text | textarea | number | date | time | boolean | select | multiselect | tags | object-list
const QUESTIONNAIRE = [
  {
    section: 'generalInfo',
    title: 'Informações Gerais',
    fields: [
      { key: 'situacaoConjugal', label: 'Situação conjugal', type: 'text' },
      { key: 'religiao', label: 'Religião', type: 'text' },
      { key: 'naturalidade', label: 'Naturalidade', type: 'text' },
      { key: 'procedencia', label: 'Procedência', type: 'text' },
      { key: 'motivoConsulta', label: 'Motivo da consulta / queixa principal', type: 'textarea' },
      { key: 'ocupacao', label: 'Ocupação', type: 'text' },
      { key: 'cargaHoraria', label: 'Carga horária', type: 'text' },
      { key: 'nomeMae', label: 'Nome da mãe', type: 'text' },
    ],
  },
  {
    section: 'socioeconomic',
    title: 'Condições Socioeconômicas',
    fields: [
      { key: 'rendaMensalFamiliar', label: 'Renda mensal familiar', type: 'text' },
      { key: 'rendaAlimentacao', label: 'Renda destinada à alimentação', type: 'text' },
      { key: 'habitacaoPropria', label: 'Habitação própria', type: 'boolean' },
      { key: 'animaisEstimacao', label: 'Animais de estimação', type: 'boolean' },
      { key: 'comQuemReside', label: 'Com quem reside', type: 'text' },
    ],
  },
  {
    section: 'lifestyle',
    title: 'Estilo de Vida',
    fields: [
      { key: 'sonoQualidade', label: 'Sono', type: 'select', options: ['Bom', 'Regular', 'Ruim', 'Péssimo'] },
      { key: 'dormeH', label: 'Dorme (h)', type: 'time' },
      { key: 'acordaH', label: 'Acorda (h)', type: 'time' },
      { key: 'etilismo', label: 'Etilismo', type: 'boolean' },
      { key: 'etilismoTipo', label: 'Etilismo — tipo/frequência/quantidade', type: 'text' },
      { key: 'tabagismo', label: 'Tabagismo', type: 'boolean' },
      { key: 'tabagismoTipo', label: 'Tabagismo — tipo/frequência/quantidade', type: 'text' },
      { key: 'fumantePassivo', label: 'Fumante passivo', type: 'boolean' },
      { key: 'disposicaoFisica', label: 'Disposição física', type: 'select', options: ['Baixa', 'Regular', 'Boa', 'Ótima', 'Ruim'] },
      { key: 'memoria', label: 'Memória', type: 'select', options: ['Baixa', 'Regular', 'Boa', 'Ótima', 'Ruim'] },
      { key: 'concentracao', label: 'Concentração', type: 'select', options: ['Baixa', 'Regular', 'Boa', 'Ótima', 'Ruim'] },
      { key: 'exercicioFisico', label: 'Pratica exercício físico', type: 'boolean' },
      { key: 'exercicioDetalhe', label: 'Exercício — tipo/intensidade/frequência/horário/duração', type: 'textarea' },
    ],
  },
  {
    section: 'dailyActivity',
    title: 'Atividade Física Diária',
    fields: [
      { key: 'tempoTela', label: 'Tempo de tela', type: 'text' },
      { key: 'tempoSentado', label: 'Tempo sentado', type: 'text' },
      { key: 'comoDesloca', label: 'Como se desloca', type: 'text' },
      { key: 'tarefasDomesticas', label: 'Tarefas domésticas', type: 'text' },
      { key: 'usoEscadas', label: 'Utilização de escadas', type: 'text' },
    ],
  },
  {
    section: 'reproduction',
    title: 'Reprodução',
    fields: [
      { key: 'gestacoes', label: 'Gestações', type: 'boolean' },
      { key: 'quantasGestacoes', label: 'Quantas', type: 'number' },
      { key: 'abortos', label: 'Abortos', type: 'boolean' },
      { key: 'cicloMenstrualDias', label: 'Ciclo menstrual (dias)', type: 'number' },
      { key: 'fluxo', label: 'Fluxo', type: 'select', options: ['Pouco', 'Regular', 'Muito'] },
      { key: 'colica', label: 'Cólica menstrual', type: 'boolean' },
      { key: 'tpm', label: 'TPM', type: 'boolean' },
      { key: 'tpmSintomas', label: 'TPM — sintomas', type: 'text' },
    ],
  },
  {
    section: 'familyHistory',
    title: 'História Patológica Familiar',
    fields: [
      { key: 'obesidade', label: 'Obesidade', type: 'boolean' },
      { key: 'dm', label: 'Diabetes (DM)', type: 'boolean' },
      { key: 'has', label: 'Hipertensão (HAS)', type: 'boolean' },
      { key: 'avc', label: 'AVC', type: 'boolean' },
      { key: 'cancer', label: 'Câncer', type: 'boolean' },
      { key: 'dislipidemia', label: 'Dislipidemia', type: 'boolean' },
      { key: 'cardiopatia', label: 'Cardiopatia', type: 'boolean' },
      { key: 'outros', label: 'Outros', type: 'text' },
    ],
  },
  {
    section: 'clinicalConditions',
    title: 'Condições Clínicas Atuais (do paciente)',
    help: 'Estas condições acionam regras automáticas na dieta (regra de ouro).',
    fields: [
      { key: 'hypertension', label: 'Hipertensão', type: 'boolean' },
      { key: 'diabetes', label: 'Diabetes', type: 'boolean' },
      { key: 'dyslipidemia', label: 'Dislipidemia', type: 'boolean' },
      { key: 'obesity', label: 'Obesidade', type: 'boolean' },
      { key: 'renalDisease', label: 'Doença renal', type: 'boolean' },
      { key: 'hepaticDisease', label: 'Doença hepática', type: 'boolean' },
      { key: 'hypothyroidism', label: 'Hipotireoidismo', type: 'boolean' },
      { key: 'other', label: 'Outras condições', type: 'text' },
    ],
  },
  {
    section: '_root',
    title: 'História Patológica e Medicação',
    fields: [
      { key: 'pathologyPast', label: 'História patológica pregressa', type: 'textarea' },
      { key: 'pathologyCurrent', label: 'História patológica atual', type: 'textarea' },
      { key: 'medicationsSupplements', label: 'Medicamentos/Suplementos em uso', type: 'textarea' },
    ],
  },
  {
    section: 'gastrointestinal',
    title: 'História Nutricional — Aparelho Gastrointestinal',
    fields: [
      {
        key: 'sintomas',
        label: 'Sintomas',
        type: 'multiselect',
        options: ['Disfagia', 'Odinofagia', 'Náuseas', 'Êmese', 'Disgeusia', 'Xerostomia', 'Dor abdominal', 'Distensão abdominal', 'Pirose', 'Refluxo'],
      },
      { key: 'flatulencia', label: 'Flatulência', type: 'select', options: ['Normal', 'Aumentada'] },
      { key: 'alimentosRelacionados', label: 'Alimentos relacionados', type: 'text' },
    ],
  },
  {
    section: 'intestinalRhythm',
    title: 'Ritmo Intestinal',
    fields: [
      { key: 'ritmo', label: 'Ritmo', type: 'select', options: ['Normal', 'Lento', 'Aumentado'] },
      { key: 'frequencia', label: 'Frequência', type: 'text' },
      { key: 'bristol', label: 'Tipo (Escala de Bristol)', type: 'select', options: ['1', '2', '3', '4', '5', '6', '7'] },
      { key: 'hemorroidas', label: 'Hemorroidas', type: 'boolean' },
      { key: 'hematoquezia', label: 'Hematoquezia', type: 'boolean' },
    ],
  },
  {
    section: 'urinaryRhythm',
    title: 'Ritmo Urinário',
    fields: [
      { key: 'ritmo', label: 'Ritmo', type: 'select', options: ['Normal', 'Lento', 'Aumentado'] },
      { key: 'frequencia', label: 'Frequência', type: 'text' },
      { key: 'armstrong', label: 'Tipo (Escala de Armstrong)', type: 'text' },
      { key: 'proteinuria', label: 'Proteinúria', type: 'boolean' },
    ],
  },
  {
    section: 'eatingHabits',
    title: 'Hábitos Alimentares',
    fields: [
      { key: 'apetite', label: 'Apetite', type: 'select', options: ['Normal', 'Aumentado', 'Reduzido'] },
      { key: 'mastigacao', label: 'Mastigação', type: 'select', options: ['Normal', 'Lenta', 'Rápida'] },
      { key: 'motivos', label: 'Motivos', type: 'text' },
    ],
  },
  {
    section: '_arrays',
    title: 'Restrições e Preferências (Regra de Ouro)',
    help: 'Alergias e intolerâncias são sincronizadas com as restrições do paciente.',
    fields: [
      { key: 'allergies', label: 'Alergias alimentares', type: 'tags' },
      { key: 'intolerances', label: 'Intolerâncias', type: 'tags' },
      { key: 'aversions', label: 'Aversões', type: 'tags' },
      { key: 'preferences', label: 'Preferências', type: 'tags' },
    ],
  },
  {
    section: 'physicalExam',
    title: 'Exame Físico / Semiologia',
    fields: [
      { key: 'cabelos', label: 'Cabelos', type: 'text' },
      { key: 'mucosas', label: 'Mucosas', type: 'text' },
      { key: 'labios', label: 'Lábios', type: 'text' },
      { key: 'lingua', label: 'Língua', type: 'text' },
      { key: 'denticao', label: 'Dentição', type: 'text' },
      { key: 'pele', label: 'Pele', type: 'text' },
      { key: 'unhas', label: 'Unhas', type: 'text' },
      { key: 'abdomen', label: 'Abdômen', type: 'text' },
      { key: 'edema', label: 'Edema', type: 'text' },
    ],
  },
  {
    section: 'dietaryRecall',
    title: 'Recordatório Alimentar Habitual',
    fields: [
      { key: 'refeicoes', label: 'Refeições (refeição/horário/local/alimentos/quantidades/obs.)', type: 'object-list' },
      { key: 'finaisDeSemana', label: 'Alimentação aos finais de semana', type: 'textarea' },
      { key: 'liquidosNaRefeicao', label: 'Ingere líquidos durante a refeição', type: 'boolean' },
    ],
  },
  {
    section: '_scalars',
    title: 'Diagnóstico e Objetivos',
    fields: [
      { key: 'waterIntakeMl', label: 'Ingestão hídrica diária (ml)', type: 'number' },
      { key: 'diagnosis', label: 'Diagnóstico nutricional', type: 'textarea' },
      { key: 'objectives', label: 'Objetivos da intervenção nutricional', type: 'textarea' },
      { key: 'status', label: 'Status do prontuário', type: 'select', options: ['draft', 'completed'] },
    ],
  },
];

// Antropometria é registrada à parte (1:N por data) — campos para o app.
const ANTHROPOMETRY_FIELDS = [
  { key: 'date', label: 'Data', type: 'date' },
  { key: 'heightCm', label: 'Altura (cm)', type: 'number' },
  { key: 'weightUsualKg', label: 'Peso usual (kg)', type: 'number' },
  { key: 'weightCurrentKg', label: 'Peso atual (kg)', type: 'number' },
  { key: 'bodyFatPercent', label: '% Gordura', type: 'number' },
  { key: 'circumferences', label: 'Circunferências (pescoço, braço, cintura, abdominal, quadril, coxa, panturrilha, RCQ)', type: 'object' },
  { key: 'skinfolds', label: 'Dobras cutâneas (DCT, DCB, DCSE, DCSI, DCA, peito, abdominal, coxa, panturrilha)', type: 'object' },
  { key: 'derived', label: 'Derivados (AGB, CMB, AMB, AMBc, ∑4, ∑2)', type: 'object' },
];

module.exports = { QUESTIONNAIRE, ANTHROPOMETRY_FIELDS };
