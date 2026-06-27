// src/providers/ai/diet-ai-client.js — provider de IA para montagem de dieta.
// Usa o SDK oficial da Anthropic (Claude) com TOOL USE forçado para obter uma
// saída estruturada (Structured Output) que mapeia exatamente Meals/MealItems.
// Toda chamada externa de IA fica encapsulada aqui (nunca no controller/service HTTP).
const Anthropic = require('@anthropic-ai/sdk');
const env = require('../../config/env');
const AppError = require('../../utils/app-error');

let client = null;
function getClient() {
  if (!env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

// Ferramenta cujo input define o formato JSON da resposta (refeições e itens).
const DIET_TOOL = {
  name: 'build_diet_plan',
  description:
    'Monta um plano alimentar estruturado com refeições e itens, respeitando as metas de macros e as restrições do paciente.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string', description: 'Título curto do plano.' },
      meals: {
        type: 'array',
        description: 'Refeições do dia, em ordem cronológica.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string', description: 'Ex: Café da Manhã, Almoço, Jantar.' },
            preferredTime: { type: 'string', description: 'Horário sugerido HH:MM (ou vazio).' },
            sortOrder: { type: 'integer', description: 'Ordem da refeição (0..n).' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  foodName: {
                    type: 'string',
                    description:
                      'Nome do alimento, preferindo termos da base TACO/TBCA (ex: "Arroz, integral, cozido").',
                  },
                  quantity: { type: 'number', description: 'Quantidade.' },
                  unit: { type: 'string', description: 'Unidade: g, ml, unidade, colher, fatia.' },
                  notes: { type: 'string', description: 'Observação opcional (pode ser vazio).' },
                },
                required: ['foodName', 'quantity', 'unit'],
              },
            },
          },
          required: ['name', 'items'],
        },
      },
    },
    required: ['title', 'meals'],
  },
};

function buildPrompt({ patient, restrictions, targets, instruction, foodCandidates }) {
  const restr = (restrictions || []).map((r) => `- ${r.type}: ${r.label}`).join('\n') || '- nenhuma';
  const cand =
    (foodCandidates || []).slice(0, 60).map((f) => `- ${f.name} (${f.kcal}kcal/100g)`).join('\n') ||
    '- (catálogo indisponível; use alimentos brasileiros comuns)';

  return [
    'Você é nutricionista. Monte um RASCUNHO de plano alimentar diário.',
    '',
    '## Perfil do paciente',
    `- Sexo: ${patient.sex ?? 'n/d'} | Idade: ${patient.age ?? 'n/d'} | Peso: ${patient.weightKg ?? 'n/d'}kg | Altura: ${patient.heightCm ?? 'n/d'}cm`,
    `- Nível de atividade: ${patient.activityLevel ?? 'n/d'} | Objetivo: ${patient.goal ?? 'n/d'}`,
    '',
    '## Restrições (RESPEITE rigorosamente)',
    restr,
    '',
    '## Metas de macros (diárias)',
    `- Calorias: ${targets.kcal} kcal`,
    `- Proteínas: ${targets.proteinG} g | Carboidratos: ${targets.carbsG} g | Gorduras: ${targets.fatG} g`,
    '',
    '## Alimentos sugeridos do catálogo (prefira estes nomes ao escolher)',
    cand,
    '',
    '## Pedido da nutricionista',
    instruction || 'Monte uma dieta equilibrada e variada distribuída em 4 a 6 refeições.',
    '',
    'Distribua os macros ao longo das refeições aproximando-se das metas. Use a ferramenta build_diet_plan.',
  ].join('\n');
}

/**
 * Gera um rascunho estruturado de dieta via IA.
 * @returns {Promise<{title:string, meals:Array}>}
 */
async function generateDietDraft(params) {
  const ai = getClient();
  if (!ai) {
    throw AppError.badRequest(
      'Serviço de IA não configurado (ANTHROPIC_API_KEY ausente).',
      'AI_NOT_CONFIGURED',
    );
  }

  let response;
  try {
    response = await ai.messages.create({
      model: env.AI_MODEL,
      max_tokens: env.AI_MAX_TOKENS,
      tools: [DIET_TOOL],
      // Força a IA a responder chamando a ferramenta → saída estruturada garantida.
      tool_choice: { type: 'tool', name: DIET_TOOL.name },
      messages: [{ role: 'user', content: buildPrompt(params) }],
    });
  } catch (err) {
    console.error('[ai] Falha ao chamar a Anthropic:', err);
    throw AppError.badRequest('Falha ao gerar a dieta via IA.', 'AI_REQUEST_FAILED');
  }

  const toolBlock = (response.content || []).find((b) => b.type === 'tool_use');
  if (!toolBlock || !toolBlock.input) {
    throw AppError.badRequest('Resposta da IA sem estrutura válida.', 'AI_BAD_OUTPUT');
  }
  return toolBlock.input;
}

module.exports = { generateDietDraft };
