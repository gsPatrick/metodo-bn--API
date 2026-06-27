# Feature: HealthMetric (Hábitos Diários e Lifestyle Score)

Registro diário de hábitos e cálculo dinâmico do **Health/Lifestyle Score** (1-100),
com unicidade por paciente+dia (upsert).

## Métricas registradas

`sleepHours` (horas de sono), `steps` (passos), `waterMl` (água em ml),
`stressLevel` (1-10, menor melhor), `dietAdherence` (1-10, maior melhor).

## Algoritmo do Score (`health-score.js`)

Cada métrica é normalizada para 0-100 e combinada por **pesos configuráveis**.
Métricas ausentes são ignoradas e os pesos **renormalizados** (faltar um dado não zera o dia).

| Métrica         | Peso | Normalização |
|-----------------|------|--------------|
| `dietAdherence` | 0,30 | `valor/10 × 100` |
| `waterMl`       | 0,25 | `ml/2500 × 100` (meta 2,5 L) |
| `sleepHours`    | 0,20 | `100 − |h−8|×15` (ideal 8h) |
| `steps`         | 0,15 | `passos/10000 × 100` (meta 10k) |
| `stressLevel`   | 0,10 | `(10−nível)/9 × 100` |

Resultado: inteiro de 1 a 100 persistido em `calculatedHealthScore`.

## Unicidade diária (upsert)

`POST /health-metrics` faz **upsert por (patientProfileId, date)**: se já existe
registro no dia, os campos enviados são mesclados sobre os existentes e o score é
recalculado — nunca duplica (também garantido por índice único no banco).

## Rotas

| Método | Caminho                          | Descrição |
|--------|----------------------------------|-----------|
| POST   | `/api/v1/health-metrics`         | Upsert do dia (`{ patientProfileId, date?, sleepHours, steps, waterMl, stressLevel, dietAdherence }`). |
| GET    | `/api/v1/health-metrics`         | Lista (`?patientProfileId=&from=&to=`). |
| GET    | `/api/v1/health-metrics/summary` | Média do score no período. |
| GET    | `/api/v1/health-metrics/:date`   | Registro de uma data (`?patientProfileId=`). |

> Acesso por ownership: paciente (próprio), nutricionista (de seus pacientes), admin.

## Erros comuns

| Código                     | HTTP | Quando |
|----------------------------|------|--------|
| `INVALID_DATE`             | 400  | `date` fora do formato `YYYY-MM-DD`. |
| `INVALID_SCALE`            | 400  | `stressLevel`/`dietAdherence` fora de 1-10. |
| `HEALTH_METRIC_FORBIDDEN`  | 403  | Métricas de outro paciente. |
| `HEALTH_METRIC_NOT_FOUND`  | 404  | Sem registro na data. |
