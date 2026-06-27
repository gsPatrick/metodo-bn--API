// src/providers/webdiet/webdiet-parser.js
// Extrai e estrutura o PDF de plano alimentar do WebDiet — SEM dependências externas.
// O PDF do WebDiet usa strings UTF-16BE em streams FlateDecode; descomprimimos com
// zlib (nativo) e decodificamos. Depois parseamos refeições, substituições, o
// relatório de nutrientes (macros), a lista de compras e as receitas culinárias.
const zlib = require('zlib');

// --- 1) Extração de texto do PDF -------------------------------------------

function pdfStringToBytes(inner) {
  const bytes = [];
  for (let i = 0; i < inner.length; i += 1) {
    const c = inner[i];
    if (c === '\\') {
      const n = inner[i + 1];
      if (n >= '0' && n <= '7') {
        let oct = n;
        i += 1;
        for (let k = 0; k < 2 && inner[i + 1] >= '0' && inner[i + 1] <= '7'; k += 1) oct += inner[(i += 1)];
        bytes.push(parseInt(oct, 8) & 0xff);
      } else {
        const map = { n: 10, r: 13, t: 9, b: 8, f: 12 };
        if (n in map) bytes.push(map[n]);
        else bytes.push((n || '').charCodeAt(0) & 0xff);
        i += 1;
      }
    } else {
      bytes.push(c.charCodeAt(0) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

function decodeStr(buf) {
  if (buf.length >= 2 && buf.length % 2 === 0) {
    let zeros = 0;
    for (let i = 0; i < buf.length; i += 2) if (buf[i] === 0) zeros += 1;
    if (zeros > buf.length / 4) {
      const b = Buffer.from(buf);
      b.swap16();
      return b.toString('utf16le').normalize('NFKC');
    }
  }
  return buf.toString('latin1').normalize('NFKC');
}

// Recebe um Buffer do PDF e devolve as linhas de texto.
function extractPdfText(buffer) {
  const text = buffer.latin1Slice(0, buffer.length);
  const out = [];
  const streamRe = /stream\r?\n/g;
  let m;
  while ((m = streamRe.exec(text)) !== null) {
    const start = m.index + m[0].length;
    const end = text.indexOf('endstream', start);
    if (end < 0) continue;
    const chunk = buffer.slice(start, end);
    let data = null;
    try {
      data = zlib.inflateSync(chunk);
    } catch {
      try {
        data = zlib.inflateRawSync(chunk);
      } catch {
        continue;
      }
    }
    for (const ln of data.toString('latin1').split(/\r?\n/)) {
      const parens = ln.match(/\((?:\\.|[^\\()])*\)/g);
      if (parens) {
        const joined = parens.map((p) => decodeStr(pdfStringToBytes(p.slice(1, -1)))).join('');
        if (joined.trim()) out.push(joined);
      }
    }
  }
  return out.join('\n');
}

// --- 2) Parsing do conteúdo -------------------------------------------------

const SKIP = [
  /^Página\b/i, /^Aluno\(a\)/i, /^Do Nascimento/i, /^Acesse o/i, /^app$/i,
  /conteúdo completo/i, /da sua consulta/i, /^e veja o/i, /^Plano alimentar$/i,
  /^Planejamento alimentar$/i, /^Prescrito em/i,
];
const isSkip = (l) => SKIP.some((re) => re.test(l));
const mealRe = (l) => /^(\d{1,2}:\d{2})\s*-\s*(.+)/.exec(l);
const subHeaderRe = (l) => /Opç[õo]es de substitui[çc][ãa]o para (.+):/i.exec(l);
const isQty = (l) =>
  /^[\d.,]/.test(l) || /\(\s*\d+(?:[.,]\d+)?\s*(g|ml)\s*\)/i.test(l) || /^\d+(?:[.,]\d+)?\s*(g|ml|kg)$/i.test(l);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const numOf = (s) => {
  const n = parseFloat(String(s).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

// Refeições + alimentos + substituições (seção antes do relatório).
function parseMeals(mealsText) {
  const lines = mealsText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !isSkip(l));
  const meals = [];
  let meal = null;
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    const mm = mealRe(l);
    if (mm) {
      meal = { time: mm[1], name: mm[2].trim(), foods: [] };
      meals.push(meal);
      i += 1;
      continue;
    }
    if (!meal) { i += 1; continue; }
    const sh = subHeaderRe(l);
    if (sh) {
      const targetName = sh[1].trim();
      const block = [];
      i += 1;
      while (i < lines.length && !mealRe(lines[i]) && !subHeaderRe(lines[i])) { block.push(lines[i]); i += 1; }
      const joined = block.join(' ').replace(/\s+/g, ' ').replace(/"/g, '').trim();
      const subs = joined
        .split(/\s*-\s*ou\s*-\s*/i)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          const ms = /^(.*?)\s*-\s*(\d.*)$/.exec(s);
          return ms ? { name: ms[1].trim(), qty: ms[2].trim() } : { name: s, qty: '' };
        });
      const food = meal.foods.find((f) => f.name.toLowerCase() === targetName.toLowerCase()) || meal.foods[meal.foods.length - 1];
      if (food) food.subs = subs;
      continue;
    }
    if (!isQty(l)) {
      const food = { name: l.replace(/^"/, '').trim(), qty: '', subs: [] };
      if (i + 1 < lines.length && isQty(lines[i + 1]) && !subHeaderRe(lines[i + 1])) { food.qty = lines[i + 1]; i += 2; } else { i += 1; }
      meal.foods.push(food);
      continue;
    }
    i += 1;
  }
  return meals;
}

// Relatório de nutrientes: total e por refeição (Proteínas, Lipídeos, Carboidratos, Calorias).
function parseReport(reportText, mealNames) {
  const totals = (() => {
    const m = /Total das refeições\s+([\d.,]+)g\s+([\d.,]+)g\s+([\d.,]+)g\s+(\d+)\s*Kcal/i.exec(reportText);
    return m ? { proteinG: numOf(m[1]), fatG: numOf(m[2]), carbsG: numOf(m[3]), kcal: numOf(m[4]) } : null;
  })();
  const perMeal = {};
  mealNames.forEach((name) => {
    const re = new RegExp(`${escapeRe(name)}\\s+([\\d.,]+)g\\s+([\\d.,]+)g\\s+([\\d.,]+)g\\s+(\\d+)\\s*Kcal`, 'i');
    const m = re.exec(reportText);
    if (m) perMeal[name] = { proteinG: numOf(m[1]), fatG: numOf(m[2]), carbsG: numOf(m[3]), kcal: numOf(m[4]) };
  });
  return { totals, perMeal };
}

// Lista de compras: itens marcados com o bullet "%ï" (glifo do WebDiet).
function parseShopping(text) {
  const start = text.search(/Lista de compras/i);
  if (start < 0) return [];
  const end = text.search(/Receita culinária/i);
  const chunk = text.slice(start + 'Lista de compras'.length, end > start ? end : undefined);
  const items = chunk
    .split(/%ï\s*|•\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  // O último item costuma trazer colado o nome da 1ª receita — corta no "Receita culinária".
  return items
    .map((s) => s.replace(/\s+(Receita culinária).*$/i, '').trim())
    .filter((s) => s && !isSkip(s) && !/Plano alimentar|Planejamento alimentar/i.test(s));
}

// Receitas culinárias: nome, rendimento, ingredientes e modo de preparo.
function parseRecipes(text) {
  const marker = /Receita culinária/gi;
  const idxs = [];
  let mm;
  while ((mm = marker.exec(text)) !== null) idxs.push(mm.index);
  if (!idxs.length) return [];
  const recipes = [];
  for (let k = 0; k < idxs.length; k += 1) {
    const markEnd = idxs[k] + 'Receita culinária'.length;
    const bodyEnd = k + 1 < idxs.length ? idxs[k + 1] : text.length;
    // nome: trecho antes do marcador, após o fim da receita anterior / lista de compras.
    const prevEnd = k === 0 ? Math.max(0, text.search(/Lista de compras/i)) : idxs[k - 1] + 'Receita culinária'.length;
    const namePart = text.slice(prevEnd, idxs[k]);
    // 1ª receita: começa após o último "%ï <produto>" da lista de compras.
    // Demais: nome vem após o fim (último ".") do preparo da receita anterior.
    let raw;
    if (k === 0) {
      raw = namePart.replace(/^[\s\S]*%ï\s*\S+\s+/, '');
    } else {
      raw = namePart;
      const ld = raw.lastIndexOf('. ');
      if (ld >= 0 && ld < raw.length - 2) raw = raw.slice(ld + 2);
    }
    // remove linhas de cabeçalho de página (quebra de página entre receitas).
    const clean = raw.split(/\r?\n/).map((s) => s.trim()).filter((s) => s && !isSkip(s) && !/Lista de compras/i.test(s));
    const name = (clean.length ? clean[clean.length - 1] : raw.trim()).trim();
    const body = text.slice(markEnd, bodyEnd);
    const yieldM = /Rendimento:\s*([^.]*)\./i.exec(body);
    const ingM = /(?:Ingredientes|INGREDIENTES|Receita):?\s*(.*?)(?:Forma de preparo|Modo de preparo|MODO DE PREPARO)/is.exec(body);
    const prepM = /(?:Forma de preparo|Modo de preparo|MODO DE PREPARO):?\s*(.*)$/is.exec(body);
    recipes.push({
      name: name || `Receita ${k + 1}`,
      yield: yieldM ? yieldM[1].trim() : null,
      ingredients: ingM ? ingM[1].replace(/\s+/g, ' ').trim() : null,
      steps: prepM ? prepM[1].replace(/\s+/g, ' ').trim() : null,
    });
  }
  return recipes;
}

// --- 3) API pública ---------------------------------------------------------

function parseWebDietText(fullText) {
  const splitAt = fullText.search(/Relatório de nutrientes/i);
  const mealsText = splitAt >= 0 ? fullText.slice(0, splitAt) : fullText;
  const reportText = splitAt >= 0 ? fullText.slice(splitAt) : '';

  const meals = parseMeals(mealsText);
  const { totals, perMeal } = parseReport(reportText, meals.map((m) => m.name));
  // injeta macros por refeição
  meals.forEach((m) => {
    if (perMeal[m.name]) m.macros = perMeal[m.name];
  });
  const prescritoEm = (() => {
    const m = /Prescrito em:\s*(\d{2}\/\d{2}\/\d{4})/i.exec(fullText);
    return m ? m[1] : null;
  })();
  const patientName = (() => {
    const m = /Paciente\s+([^|]+?)\s*\|/i.exec(fullText);
    return m ? m[1].trim() : null;
  })();

  return {
    source: 'webdiet',
    patientName,
    prescritoEm,
    totals,
    meals,
    shopping: parseShopping(reportText || fullText),
    recipes: parseRecipes(reportText || fullText),
  };
}

function parseWebDietPdf(buffer) {
  return parseWebDietText(extractPdfText(buffer));
}

module.exports = { extractPdfText, parseWebDietText, parseWebDietPdf };
