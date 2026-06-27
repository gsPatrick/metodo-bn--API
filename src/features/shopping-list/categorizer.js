// src/features/shopping-list/categorizer.js — classificação por gôndola de mercado.
// Mapeia a categoria TACO/TBCA do Food OU usa palavras-chave do nome do item.
// Função pura: facilita teste e ajuste do mapeamento.

// Categorias de gôndola usadas na lista de compras.
const AISLE = {
  HORTIFRUTI: 'Hortifruti',
  ACOUGUE: 'Açougue',
  LATICINIOS: 'Laticínios e Ovos',
  PADARIA: 'Padaria',
  BEBIDAS: 'Bebidas',
  MERCEARIA: 'Mercearia',
};

// Mapa categoria do catálogo (TACO/TBCA) -> gôndola.
const FOOD_CATEGORY_MAP = {
  Frutas: AISLE.HORTIFRUTI,
  'Verduras e Legumes': AISLE.HORTIFRUTI,
  Tuberculos: AISLE.HORTIFRUTI,
  Tubérculos: AISLE.HORTIFRUTI,
  Carnes: AISLE.ACOUGUE,
  Aves: AISLE.ACOUGUE,
  Pescados: AISLE.ACOUGUE,
  Ovos: AISLE.LATICINIOS,
  Laticinios: AISLE.LATICINIOS,
  Laticínios: AISLE.LATICINIOS,
  'Cereais e derivados': AISLE.MERCEARIA,
  Leguminosas: AISLE.MERCEARIA,
  'Oleos e Gorduras': AISLE.MERCEARIA,
  'Óleos e Gorduras': AISLE.MERCEARIA,
  'Castanhas e Oleaginosas': AISLE.MERCEARIA,
  'Acucares e Doces': AISLE.MERCEARIA,
  'Açúcares e Doces': AISLE.MERCEARIA,
};

// Palavras-chave -> gôndola (fallback quando não há categoria de catálogo).
const KEYWORDS = [
  [AISLE.LATICINIOS, ['leite', 'queijo', 'iogurte', 'requeijao', 'requeijão', 'manteiga', 'ovo', 'nata', 'creme de leite']],
  [AISLE.ACOUGUE, ['frango', 'carne', 'bovina', 'suina', 'suína', 'peixe', 'tilapia', 'tilápia', 'file', 'filé', 'sardinha', 'atum', 'linguica', 'linguiça', 'patinho', 'coxa', 'peito']],
  [AISLE.HORTIFRUTI, ['alface', 'tomate', 'cebola', 'alho', 'banana', 'maca', 'maçã', 'laranja', 'mamao', 'mamão', 'cenoura', 'brocolis', 'brócolis', 'batata', 'mandioca', 'abobora', 'abóbora', 'couve', 'espinafre', 'limao', 'limão', 'abacate', 'verdura', 'legume', 'fruta']],
  [AISLE.PADARIA, ['pao', 'pão', 'baguete', 'bisnaga', 'broa']],
  [AISLE.BEBIDAS, ['agua', 'água', 'suco', 'refrigerante', 'cha', 'chá', 'cafe', 'café', 'bebida']],
  [AISLE.MERCEARIA, ['arroz', 'feijao', 'feijão', 'farinha', 'oleo', 'óleo', 'azeite', 'acucar', 'açúcar', 'macarrao', 'macarrão', 'aveia', 'sal', 'molho', 'enlatado', 'biscoito', 'cereal', 'castanha', 'amendoim']],
];

function normalize(str) {
  return String(str || '').toLowerCase();
}

/**
 * Classifica um item por gôndola.
 * @param {{ name?: string, foodCategory?: string|null }} input
 * @returns {string} categoria de gôndola
 */
function categorize({ name, foodCategory } = {}) {
  if (foodCategory && FOOD_CATEGORY_MAP[foodCategory]) {
    return FOOD_CATEGORY_MAP[foodCategory];
  }
  const n = normalize(name);
  for (const [aisle, words] of KEYWORDS) {
    if (words.some((w) => n.includes(w))) return aisle;
  }
  return AISLE.MERCEARIA; // padrão seguro
}

module.exports = { categorize, AISLE };
