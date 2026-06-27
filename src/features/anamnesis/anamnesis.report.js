// src/features/anamnesis/anamnesis.report.js — renderiza o prontuário em HTML
// imprimível (sem dependência de lib de PDF; o app/navegador imprime em PDF).
// Função pura: recebe o objeto de relatório (service.buildReport) e devolve HTML.

function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Renderiza um bloco JSONB como lista chave: valor (1 nível).
function renderObject(obj) {
  if (!obj || typeof obj !== 'object') return '';
  const rows = Object.entries(obj)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => {
      const val = typeof v === 'object' ? JSON.stringify(v) : v;
      return `<li><strong>${esc(k)}:</strong> ${esc(val)}</li>`;
    })
    .join('');
  return rows ? `<ul>${rows}</ul>` : '<p class="muted">—</p>';
}

function chips(arr) {
  if (!Array.isArray(arr) || !arr.length) return '<span class="muted">nenhuma</span>';
  return arr.map((x) => `<span class="chip">${esc(x)}</span>`).join(' ');
}

function section(title, inner) {
  return `<section><h2>${esc(title)}</h2>${inner}</section>`;
}

function assessmentsTable(assessments = []) {
  if (!assessments.length) return '<p class="muted">Sem avaliações registradas.</p>';
  const rows = assessments
    .map(
      (a) => `<tr>
        <td>${esc(a.date)}</td>
        <td>${esc(a.heightCm)}</td>
        <td>${esc(a.weightCurrentKg)}</td>
        <td>${esc(a.imc)}</td>
        <td>${esc(a.bodyFatPercent)}</td>
      </tr>`,
    )
    .join('');
  return `<table>
    <thead><tr><th>Data</th><th>Altura (cm)</th><th>Peso (kg)</th><th>IMC</th><th>% MG</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function examsBlock(exams = []) {
  if (!exams.length) return '<p class="muted">Sem exames registrados.</p>';
  return exams
    .map(
      (e) => `<div class="card">
        <p><strong>${esc(e.date)}</strong> ${e.laboratory ? `— ${esc(e.laboratory)}` : ''}</p>
        ${renderObject(e.results)}
        ${e.otherExams ? `<p>${esc(e.otherExams)}</p>` : ''}
      </div>`,
    )
    .join('');
}

function evolutionsBlock(evolutions = []) {
  if (!evolutions.length) return '<p class="muted">Sem evoluções registradas.</p>';
  return evolutions
    .map((e) => `<div class="card"><p><strong>${esc(e.date)}</strong></p><p>${esc(e.notes)}</p></div>`)
    .join('');
}

function renderReport(report) {
  const a = report.anamnesis || {};
  const g = report.goldenRule || {};
  const p = report.patient || {};

  const textBlock = (label, value) =>
    value ? `<p><strong>${esc(label)}:</strong> ${esc(value)}</p>` : '';

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Prontuário — ${esc(p.name || 'Paciente')}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; color:#1f2937; margin:24px; }
    h1 { font-size:20px; margin:0 0 4px; }
    h2 { font-size:15px; border-bottom:2px solid #16a34a; padding-bottom:4px; margin:20px 0 8px; }
    .muted { color:#9ca3af; }
    .chip { display:inline-block; background:#ecfdf5; color:#065f46; border-radius:10px; padding:2px 8px; margin:2px; font-size:12px; }
    table { width:100%; border-collapse:collapse; font-size:13px; }
    th, td { border:1px solid #e5e7eb; padding:6px 8px; text-align:left; }
    th { background:#f3f4f6; }
    .card { border:1px solid #e5e7eb; border-radius:8px; padding:8px 12px; margin:6px 0; }
    ul { margin:4px 0; padding-left:18px; font-size:13px; }
    .header-meta { color:#6b7280; font-size:12px; }
    .alert { background:#fef2f2; border:1px solid #fecaca; color:#991b1b; border-radius:8px; padding:8px 12px; }
    @media print { body { margin:0; } }
  </style>
</head>
<body>
  <h1>Prontuário Nutricional — ${esc(p.name || 'Paciente')}</h1>
  <p class="header-meta">
    ${esc(p.email || '')} ${p.phone ? `· ${esc(p.phone)}` : ''}
    · Sexo: ${esc(p.sex || '—')} · Objetivo: ${esc(p.goal || '—')}
    · Gerado em ${esc(report.generatedAt)}
  </p>

  ${section(
    'Regra de Ouro (restrições e condições)',
    `<p><strong>Alergias:</strong> ${chips(g.allergies)}</p>
     <p><strong>Intolerâncias:</strong> ${chips(g.intolerances)}</p>
     <p><strong>Aversões:</strong> ${chips(g.aversions)}</p>
     <p><strong>Preferências:</strong> ${chips(g.preferences)}</p>
     <p><strong>Condições clínicas:</strong> ${chips(
       Object.entries(g.clinicalConditions || {})
         .filter(([, v]) => v === true || (typeof v === 'string' && v))
         .map(([k]) => k),
     )}</p>
     ${
       report.clinicalNotes && report.clinicalNotes.length
         ? `<div class="alert"><strong>Orientações automáticas:</strong><ul>${report.clinicalNotes
             .map((n) => `<li>${esc(n)}</li>`)
             .join('')}</ul></div>`
         : ''
     }`,
  )}

  ${section('Antropometria', assessmentsTable(report.assessments))}

  ${section(
    'História Patológica',
    `${textBlock('Atual', a.pathologyCurrent)}
     ${textBlock('Pregressa', a.pathologyPast)}
     ${textBlock('Medicamentos/Suplementos', a.medicationsSupplements)}
     ${a.familyHistory ? `<p><strong>Familiar:</strong></p>${renderObject(a.familyHistory)}` : ''}`,
  )}

  ${section('Estilo de Vida', renderObject(a.lifestyle))}
  ${section('Hábitos Alimentares', renderObject(a.eatingHabits))}
  ${section('Recordatório Alimentar', renderObject(a.dietaryRecall))}
  ${section('Exame Físico / Semiologia', renderObject(a.physicalExam))}
  ${section('Exames Bioquímicos', examsBlock(report.exams))}
  ${section(
    'Diagnóstico e Objetivos',
    `${textBlock('Diagnóstico nutricional', a.diagnosis)}${textBlock('Objetivos', a.objectives)}`,
  )}
  ${section('Evolução Nutricional', evolutionsBlock(report.evolutions))}
</body>
</html>`;
  return html;
}

module.exports = { renderReport };
