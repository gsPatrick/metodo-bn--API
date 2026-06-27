# Feature: Anamnesis (Prontuário Nutricional + Regra de Ouro)

Digitaliza a **Anamnese Nutricional Adulto** completa (formulário da clínica-escola)
e a torna a **regra de ouro** do sistema: peso/altura mais recentes alimentam os
cálculos e alergias/intolerâncias/patologias entram como restrições obrigatórias
na geração de dietas.

## Estrutura de dados

| Entidade | Cardinalidade | Conteúdo |
|----------|---------------|----------|
| **Anamnesis** | 1:1 com paciente | Prontuário-mestre. Blocos JSONB espelhando o formulário + restrições estruturadas. |
| **AnthropometricAssessment** | 1:N (datas) | Avaliação antropométrica longitudinal — fonte autoritativa de peso/altura. |
| **BiochemicalExam** | 1:N (datas) | Painéis de exames (resultados em JSONB). |
| **NutritionalEvolution** | 1:N | Notas de evolução por consulta. |

### Mapeamento do formulário → `Anamnesis`

- `generalInfo` — situação conjugal, religião, naturalidade, procedência, motivo da
  consulta/queixa, ocupação, carga horária, nome da mãe.
- `socioeconomic` — renda familiar, renda p/ alimentação, habitação, animais, com quem reside.
- `lifestyle` — sono, etilismo, tabagismo, disposição, memória, concentração, exercício físico.
- `dailyActivity` — tempo de tela/sentado, deslocamento, tarefas domésticas, escadas.
- `reproduction` — gestações, abortos, ciclo menstrual, fluxo, cólica, TPM.
- `familyHistory` — obesidade, DM, HAS, AVC, câncer, dislipidemia, cardiopatia, outros.
- `pathologyPast` / `pathologyCurrent` / `medicationsSupplements` — texto livre.
- `gastrointestinal` / `intestinalRhythm` / `urinaryRhythm` / `eatingHabits` — história nutricional.
- **`allergies` / `intolerances` / `aversions` / `preferences`** — arrays estruturados (regra de ouro).
- `physicalExam` — semiologia (cabelos, mucosas, lábios, língua, dentição, pele, unhas, abdômen, edema).
- `foodFrequency` — frequência alimentar + tipo de óleo, gordura visível, pele do frango, sal depois de pronto.
- `dietaryRecall` — recordatório habitual + finais de semana + líquidos na refeição.
- `waterIntakeMl` — ingestão hídrica diária (numérica, usada em cálculo).
- `diagnosis` / `objectives` — diagnóstico nutricional e objetivos da intervenção.

> A `AnthropometricAssessment` guarda altura, peso usual/atual, IMC (calculado),
> % MG, circunferências, dobras cutâneas e derivados (AGB, CMB, AMB, ∑dobras…).

## Regra de Ouro (integração com a dieta)

`anamnesis.service.getGoldenRule(patientProfileId)` consolida e é consumido pelo
módulo **diet-plan**:
- **Cálculo (TDEE)**: `computeTargetsForPatient`, `createPlan` e `generateWithAI`
  usam a **antropometria mais recente** (peso/altura) em vez do `PatientProfile`,
  caindo nele se não houver avaliação. A resposta de metas inclui `anthropometrySource`.
- **Regras clínicas automáticas** (`diet-plan/clinical-rules.js`) a partir de
  `clinicalConditions`: **Diabetes** → carbo ≤ 45% kcal + fibra ≥ 25 g; **HAS** →
  sódio ≤ 2000 mg (DASH); **Doença renal** → proteína ≤ ~0,8 g/kg; **Dislipidemia**
  e **Obesidade/IMC≥30** → orientações. Os macros das metas são ajustados e as
  notas (`clinicalNotes`) vão para a nutricionista e para o prompt da IA.
- **Geração por IA**: `allergies` + `intolerances` + `aversions` viram restrições
  enviadas ao Claude; as notas clínicas (sódio/fibra/patologias) entram como orientações.

## Sincronização de restrições

No `PUT` da anamnese, alergias/intolerâncias/aversões são **sincronizadas** com
`PatientRestriction` (origem `source = 'anamnesis'`), preservando as cadastradas
manualmente (`source = 'manual'`). Tudo em transação.

## Questionário guiado e relatório

- `GET /anamnesis/schema` — catálogo declarativo (seções + campos + tipos/opções)
  para o app renderizar a anamnese **pergunta a pergunta**.
- `GET /anamnesis/:id/report` — prontuário consolidado (JSON).
- `GET /anamnesis/:id/report.html` — versão **imprimível** (HTML → o app/navegador
  imprime em PDF, sem dependência de lib).

## Validação

`PUT` e `POST /assessments` passam por validação robusta (`anamnesis.validation.js`):
blocos devem ser objetos; arrays só strings; `waterIntakeMl` 0–20000; antropometria
em faixas plausíveis (altura 50–260, peso 1–500, %MG 0–75) e exige ao menos uma
medida. Erros retornam `422 VALIDATION_ERROR` com `details` campo-a-campo.
Cobertos por `npm run selfcheck:anamnesis` (22 asserções, sem banco).

## Acesso (ownership)

Leitura: paciente (próprio), nutricionista (de seus pacientes), admin.
**Edição** (upsert, antropometria, exames, evolução): nutricionista/admin.

## Rotas

| Método | Caminho                                              | Descrição |
|--------|------------------------------------------------------|-----------|
| GET    | `/api/v1/anamnesis/schema`                           | Catálogo do questionário guiado. |
| GET    | `/api/v1/anamnesis/:patientProfileId`                | Prontuário-mestre. |
| PUT    | `/api/v1/anamnesis/:patientProfileId`                | Upsert por blocos (valida + sincroniza restrições). |
| GET    | `/api/v1/anamnesis/:patientProfileId/golden-rule`    | Regra de ouro consolidada. |
| GET    | `/api/v1/anamnesis/:patientProfileId/report`         | Prontuário consolidado (JSON). |
| GET    | `/api/v1/anamnesis/:patientProfileId/report.html`    | Prontuário imprimível (HTML). |
| GET/POST | `/api/v1/anamnesis/:patientProfileId/assessments`  | Antropometria (lista / adiciona). |
| DELETE | `/api/v1/anamnesis/assessments/:assessmentId`        | Remove avaliação. |
| GET/POST | `/api/v1/anamnesis/:patientProfileId/exams`        | Exames bioquímicos. |
| GET/POST | `/api/v1/anamnesis/:patientProfileId/evolutions`   | Evolução nutricional. |

## Payloads

### PUT /anamnesis/:patientProfileId (parcial — mescla blocos)
```json
{
  "allergies": ["amendoim", "frutos do mar"],
  "intolerances": ["lactose"],
  "preferences": ["vegetariana"],
  "familyHistory": { "has": true, "dm": true, "obesidade": false },
  "lifestyle": { "sono": { "qualidade": "regular", "dormeH": "23:30", "acordaH": "06:30" } },
  "waterIntakeMl": 2000,
  "status": "completed"
}
```

### POST /anamnesis/:patientProfileId/assessments
```json
{
  "date": "2026-06-24",
  "heightCm": 168, "weightCurrentKg": 72.4, "weightUsualKg": 75,
  "bodyFatPercent": 28.5,
  "circumferences": { "waist": 84, "hip": 102, "rcq": 0.82, "arm": 30 },
  "skinfolds": { "dct": 22, "dcse": 18 }
}
```
> `imc` é calculado automaticamente se não enviado.

## Erros comuns

| Código                 | HTTP | Quando |
|------------------------|------|--------|
| `ANAMNESIS_FORBIDDEN`  | 403  | Anamnese de outro paciente. |
| `NOT_NUTRITIONIST`     | 403  | Paciente tentando editar. |
| `PROFILE_NOT_FOUND`    | 404  | `patientProfileId` inexistente. |
| `ASSESSMENT_NOT_FOUND` | 404  | Avaliação inexistente. |
