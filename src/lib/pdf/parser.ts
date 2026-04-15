// Parser de questões extraídas de PDF — formato ENAMED / Estratégia MED
// Suporta o formato completo com áreas de conhecimento, referências,
// comentários longos e gabarito inline, além de formatos mais simples.

/** Questão parseada de PDF — 4 options (A-D) */
export interface ParsedQuestion {
  order: number;
  text: string;
  options: {
    label: string;
    text: string;
    isCorrect: boolean;
  }[];
  explanation?: string;
  hasImage: boolean;
  areaConhecimento?: string;
  reference?: string;
}

// ---------------------------------------------------------------------------
// Áreas de conhecimento reconhecidas (uppercase, sem acento, para matching)
// ---------------------------------------------------------------------------
const KNOWN_AREAS = [
  "CLÍNICA MÉDICA",
  "CLINICA MEDICA",
  "CIRURGIA GERAL",
  "CIRURGIA",
  "GINECOLOGIA E OBSTETRÍCIA",
  "GINECOLOGIA E OBSTETRICIA",
  "GINECOLOGIA",
  "OBSTETRÍCIA",
  "OBSTETRICIA",
  "PEDIATRIA",
  "MEDICINA PREVENTIVA",
  "MEDICINA DE FAMÍLIA",
  "MEDICINA DE FAMILIA",
  "SAÚDE COLETIVA",
  "SAUDE COLETIVA",
  "ORTOPEDIA",
  "OFTALMOLOGIA",
  "OTORRINOLARINGOLOGIA",
  "CARDIOLOGIA",
  "ENDOCRINOLOGIA",
  "INFECTOLOGIA",
  "NEFROLOGIA",
  "NEUROLOGIA",
  "PNEUMOLOGIA",
  "REUMATOLOGIA",
  "DERMATOLOGIA",
  "GASTROENTEROLOGIA",
  "HEMATOLOGIA",
  "UROLOGIA",
  "PSIQUIATRIA",
  "GERIATRIA",
  "MEDICINA INTENSIVA",
  "EMERGÊNCIA",
  "EMERGENCIA",
];

/**
 * Detecta se uma linha isolada representa uma área de conhecimento.
 * Retorna o nome da área ou null.
 */
export function detectAreaConhecimento(text: string): string | null {
  const trimmed = text.trim();
  // Deve ser uma linha curta, toda em maiúsculas (pode ter acentos)
  if (trimmed.length === 0 || trimmed.length > 60) return null;

  // Checa se a linha é toda maiúscula (ignorando espaços/pontuação)
  const letters = trimmed.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (letters.length === 0) return null;
  if (letters !== letters.toUpperCase()) return null;

  // Tenta match exato contra áreas conhecidas
  const normalized = trimmed
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ");

  for (const area of KNOWN_AREAS) {
    const areaNorm = area
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/\s+/g, " ");
    if (normalized === areaNorm) return trimmed;
  }

  // Se não bate exatamente mas parece um título de área (curto, uppercase, sem
  // número, sem pontuação de alternativa), aceita como área genérica
  if (
    /^[A-ZÀ-ÿ\s,E]+$/.test(trimmed) &&
    trimmed.length >= 4 &&
    trimmed.length <= 50 &&
    !/^\d/.test(trimmed)
  ) {
    return trimmed;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Regex helpers
// ---------------------------------------------------------------------------

/**
 * Regex para início de questão: um número seguido de ponto (ou parêntese),
 * opcionalmente precedido por "Questão".
 *
 * Captura: group 1 = número da questão
 *
 * Exemplos que casam:
 *   "1. (Estratégia MED ...)"
 *   "12. Um paciente..."
 *   "Questão 3 – ..."
 *   "03) ..."
 */
const QUESTION_START_RE =
  /(?:^|\n)\s*(?:quest[aã]o\s+)?(\d{1,3})\s*[.):\-–—]\s*/gi;

/**
 * Regex para alternativas A) ... D)
 * Captura: group 1 = label (A-D), group 2 = texto (tudo até próxima alternativa
 * ou fim de seção)
 */
const OPTION_LINE_RE = /(?:^|\n|[.?!;]\s*|\s{2,})\(?\s*([A-Ea-e])\s*[)\].:\-–—]\s*/gi;

/**
 * Regex para o bloco COMENTÁRIO (pode usar acento ou não)
 */
const COMENTARIO_RE = /\n\s*COMENT[AÁ]RIO\s*:\s*/i;

/**
 * Regex para gabarito inline
 */
const GABARITO_RE = /(?:Gabarito|Resposta)\s*:?\s*([A-Ea-e])/i;

/**
 * Referência entre parênteses no início da questão, ex:
 *   (Estratégia MED 2025 – Inédita – Endocrinologia - Prof. Ênio Macedo)
 */
const REFERENCE_RE = /^\s*\(([^)]{10,})\)\s*/;

/**
 * Palavras-chave que indicam presença de imagem na questão.
 */
const IMAGE_KEYWORDS_RE =
  /\bimagem\b|\bfigura\b|\bradiografia\b|\btomografia\b|\bressonância\b|\bultrassonografia\b|\bfoto\b|\becografia\b|\beletrocardiograma\b|\becg\b|\brx\b|\braio[- ]?x\b|\b\[imagem\]\b|\b\[figura\]\b|\bfig\.\s*\d/i;

// ---------------------------------------------------------------------------
// Gabarito comentado parser (formato Estratégia MED / similares)
// Formato: "N - YYYY BANCA - CIDADE" seguido de comentário + "Resposta: letra X"
// ---------------------------------------------------------------------------

/**
 * Regex para cabeçalho de questão no formato gabarito comentado.
 * Exemplos: "6 - 2022 SUS - SP", "15 - 2022 SCMSP", "100 - 2021 USP - RP"
 */
const GABARITO_HEADER_RE =
  /(?:^|\n)\s*(\d{1,3})\s*-\s*(\d{4}\s+[A-Za-zÀ-ÿ\s\-]+)/g;

/**
 * Regex para "Resposta: letra X" no final do comentário.
 */
const RESPOSTA_LETRA_RE = /Resposta:?\s*(?:letra\s+)?([A-Ea-e])/i;

/**
 * Regex para alternativas inline no formato gabarito:
 *   "A) Incorreta." / "B) Correta." / "LETRA A CORRETA"
 */
const INLINE_ALT_RE =
  /([A-E])\)\s*((?:Incorreta|Correta|INCORRETA|CORRETA)[.!]?\s*[^A-E]*?)(?=\s*[A-E]\)\s*(?:Incorreta|Correta|INCORRETA|CORRETA)|Resposta:|Video\s*coment|$)/gi;

const LETRA_ALT_RE = /LETRA[S]?\s+([A-E])\s+(CORRETA|INCORRETA)/gi;

/**
 * Detecta e parseia formato de gabarito comentado.
 * Retorna array vazio se o texto não estiver nesse formato.
 */
function parseGabaritoComentado(text: string): ParsedQuestion[] {
  // Verifica se o formato é gabarito: precisa ter pelo menos 3 matches do padrão "N - YYYY BANCA"
  const headerTest = text.match(/\d{1,3}\s*-\s*\d{4}\s+[A-Za-z]/g);
  if (!headerTest || headerTest.length < 3) return [];

  // Também precisa ter pelo menos 1 "Resposta: letra" para confirmar
  if (!/Resposta:\s*letra\s+[A-Ea-e]/i.test(text)) return [];

  // ---- 1. Extrair grid de respostas do topo (se existir) ----
  const answerGrid: Map<number, string> = new Map();
  // O grid aparece como letras separadas por tabs/espaços: "A C C E A E D C * C C B..."
  // Seguido de "Legenda:" e depois os cabeçalhos das questões
  const legendaIdx = text.indexOf("Legenda:");
  if (legendaIdx > 0) {
    const gridSection = text.substring(0, legendaIdx);
    // Encontra o primeiro bloco de letras em grid (após "-- 1 of N --" ou no início)
    const gridMatch = gridSection.match(
      /(?:--\s*\d+\s*of\s*\d+\s*--\s*\n)?((?:[A-E*!]\s+)+[A-E*!](?:\s*\n(?:[A-E*!]\s+)*[A-E*!])*)/i
    );
    if (gridMatch) {
      const letters = gridMatch[1]
        .replace(/[*!]/g, "") // remove anuladas/dissertativas
        .split(/\s+/)
        .filter((l) => /^[A-Ea-e]$/.test(l))
        .map((l) => l.toUpperCase());

      // Precisamos saber qual é o primeiro número de questão
      GABARITO_HEADER_RE.lastIndex = 0;
      const firstHeader = GABARITO_HEADER_RE.exec(text);
      const firstNum = firstHeader ? parseInt(firstHeader[1], 10) : 1;

      letters.forEach((letter, i) => {
        answerGrid.set(firstNum + i, letter);
      });
    }
  }

  // ---- 2. Encontrar todos os blocos de questão ----
  GABARITO_HEADER_RE.lastIndex = 0;
  const headers: { index: number; order: number; source: string }[] = [];
  let m: RegExpExecArray | null;

  while ((m = GABARITO_HEADER_RE.exec(text)) !== null) {
    const order = parseInt(m[1], 10);
    const source = m[2].trim();
    // Evitar duplicatas (o grid de números no topo pode fazer match)
    if (!headers.find((h) => h.order === order)) {
      headers.push({ index: m.index, order, source });
    }
  }

  if (headers.length < 3) return [];

  // ---- 3. Parsear cada bloco ----
  const questions: ParsedQuestion[] = [];

  for (let i = 0; i < headers.length; i++) {
    INLINE_ALT_RE.lastIndex = 0;
    LETRA_ALT_RE.lastIndex = 0;
    OPTION_LINE_RE.lastIndex = 0;

    const header = headers[i];
    const blockEnd =
      i + 1 < headers.length ? headers[i + 1].index : text.length;
    const block = text.slice(header.index, blockEnd).trim();

    // Remover o cabeçalho "N - YYYY BANCA - CIDADE"
    const headerLineEnd = block.indexOf("\n");
    const commentary =
      headerLineEnd > 0 ? block.slice(headerLineEnd + 1).trim() : "";

    if (!commentary) continue;

    // Extrair "Resposta: letra X"
    const respostaMatch = commentary.match(RESPOSTA_LETRA_RE);
    const correctLabel = respostaMatch
      ? respostaMatch[1].toUpperCase()
      : answerGrid.get(header.order) ?? undefined;

    // Helper to clean a text fragment (remove video/resposta, collapse whitespace)
    const cleanFragment = (s: string) =>
      s
        .replace(/Video\s*coment[aá]rio:?\s*\d*/gi, "")
        .replace(/Resposta:?\s*(?:letra\s+)?[A-Ea-e]\.?/gi, "")
        .replace(/\n/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    // Tentar extrair alternativas inline
    const options: ParsedQuestion["options"] = [];

    // Track which extraction method found options and positions for text/explanation splitting
    let firstOptIndex = -1; // position of first option in `commentary`
    let lastOptEnd = -1;    // position after the last option text in `commentary`

    INLINE_ALT_RE.lastIndex = 0;
    let altMatch: RegExpExecArray | null;
    while ((altMatch = INLINE_ALT_RE.exec(commentary)) !== null) {
      const label = altMatch[1].toUpperCase();
      if (!options.find((o) => o.label === label)) {
        if (firstOptIndex < 0) firstOptIndex = altMatch.index;
        lastOptEnd = altMatch.index + altMatch[0].length;
        const altText = altMatch[2]
          .replace(/\n/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        options.push({
          label,
          text: altText,
          isCorrect: correctLabel ? label === correctLabel : false,
        });
      }
    }

    // Se não encontrou inline alts, tenta LETRA X CORRETA/INCORRETA
    if (options.length === 0) {
      LETRA_ALT_RE.lastIndex = 0;
      let letraMatch: RegExpExecArray | null;
      while ((letraMatch = LETRA_ALT_RE.exec(commentary)) !== null) {
        const label = letraMatch[1].toUpperCase();
        const isCorrect = letraMatch[2].toUpperCase() === "CORRETA";
        if (!options.find((o) => o.label === label)) {
          if (firstOptIndex < 0) firstOptIndex = letraMatch.index;
          lastOptEnd = letraMatch.index + letraMatch[0].length;
          options.push({ label, text: "", isCorrect });
        }
      }
    }

    // Se ainda sem opções, tenta OPTION_LINE_RE no texto do bloco
    if (options.length === 0) {
      OPTION_LINE_RE.lastIndex = 0;
      const optPositions: { label: string; start: number; matchIndex: number }[] = [];
      let olrMatch: RegExpExecArray | null;
      while ((olrMatch = OPTION_LINE_RE.exec(commentary)) !== null) {
        const lbl = olrMatch[1].toUpperCase();
        if (!optPositions.find((o) => o.label === lbl)) {
          optPositions.push({ label: lbl, start: olrMatch.index + olrMatch[0].length, matchIndex: olrMatch.index });
        }
      }
      if (optPositions.length > 0) {
        firstOptIndex = optPositions[0].matchIndex;
      }
      for (let j = 0; j < optPositions.length; j++) {
        let end: number;
        if (j + 1 < optPositions.length) {
          end = optPositions[j + 1].matchIndex;
        } else {
          // Last option: text goes only to the end of the line (next newline)
          const nlAfterLastOpt = commentary.indexOf("\n", optPositions[j].start);
          end = nlAfterLastOpt > 0 ? nlAfterLastOpt : commentary.length;
        }
        const optText = commentary.slice(optPositions[j].start, end)
          .replace(/\n/g, " ").replace(/\s+/g, " ")
          .replace(/Resposta:.*$/i, "").trim()
          .replace(/[.,;]+$/, "").trim();
        const finalOptText = optText.length > 500 ? optText.slice(0, 500) + "..." : optText;
        const corrLabel = correctLabel || (commentary.match(/Resposta:?\s*([A-Ea-e])/i)?.[1]?.toUpperCase());
        options.push({
          label: optPositions[j].label,
          text: finalOptText,
          isCorrect: corrLabel ? optPositions[j].label === corrLabel : false,
        });
        lastOptEnd = end;
      }
    }

    // Se ainda sem opções mas temos resposta correta, criar placeholder
    if (options.length === 0 && correctLabel) {
      for (const label of ["A", "B", "C", "D"]) {
        options.push({
          label,
          text: "",
          isCorrect: label === correctLabel,
        });
      }
    }

    // Marcar correta se temos grid
    if (correctLabel && options.length > 0) {
      const correctOpt = options.find((o) => o.label === correctLabel);
      if (correctOpt && !options.some((o) => o.isCorrect)) {
        correctOpt.isCorrect = true;
      }
    }

    const hasImage = IMAGE_KEYWORDS_RE.test(block);

    // ---- Split text (enunciado) vs explanation ----
    let questionText: string;
    let explanationText: string | undefined;

    if (firstOptIndex > 0) {
      // Everything before first option = enunciado
      questionText = cleanFragment(commentary.slice(0, firstOptIndex));
      // Everything after last option and before "Resposta:" = explanation
      const afterOpts = commentary.slice(lastOptEnd);
      explanationText = cleanFragment(afterOpts) || undefined;
    } else {
      // No options found — try to split at common explanation markers
      const explanationMarkerRe =
        /(?:^|\n)\s*(?:O diagn[oó]stico|Primeiro,?\s*note que|Vamos por partes|A resposta|Trata-se de|Neste caso|A alternativa|Essa quest[aã]o|A quest[aã]o|Comentário|COMENT[AÁ]RIO|O paciente|O quadro|A principal|O tratamento|A conduta|Estrategista|Caro\s+Estrategista|Video\s*coment|Gabarito)/m;
      const markerMatch = commentary.match(explanationMarkerRe);
      if (markerMatch && markerMatch.index != null && markerMatch.index > 0) {
        questionText = cleanFragment(commentary.slice(0, markerMatch.index));
        explanationText = cleanFragment(commentary.slice(markerMatch.index)) || undefined;
      } else {
        // Fallback: entire commentary as text, no separate explanation
        questionText = cleanFragment(commentary);
        explanationText = undefined;
      }
    }

    if (explanationText) {
      explanationText = explanationText
        .replace(/Video\s*coment[aá]rio:?\s*\d*/gi, "")
        .replace(/Resposta:?\s*(?:letra\s+)?[A-Ea-e]\.?/gi, "")
        .replace(/^\s*[.,:;]\s*/, "")
        .trim() || undefined;
    }

    questions.push({
      order: header.order,
      text: questionText,
      options,
      explanation: explanationText,
      hasImage,
      reference: header.source,
    });
  }

  return questions;
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

/**
 * Normaliza texto extraído por OCR, corrigindo artefatos comuns:
 * - "Respos ta" → "Resposta" (palavras quebradas por espaços extras)
 * - "G a b a r i t o" → "Gabarito"
 * Só reescreve onde a palavra completa é reconhecida (não afeta texto limpo).
 */
function normalizeOcrText(text: string): string {
  const commonWords = [
    "Resposta",
    "Gabarito",
    "Comentário",
    "Comentario",
    "Explicação",
    "Explicacao",
    "Questão",
    "Questao",
    "letra",
    "correta",
    "alternativa",
  ];
  let out = text;
  for (const word of commonWords) {
    // Permite 0-2 espaços entre cada par de letras
    const pattern = word.split("").join("\\s{0,2}");
    out = out.replace(new RegExp(pattern, "gi"), word);
  }
  return out;
}

/**
 * Recupera labels de opções (A/B/C/D) corrompidas por OCR.
 *
 * Padrões comuns de erro OCR observados em scans de provas médicas:
 *   - "A)" → "AJ", "A]", "Al", "Aj"  (parêntese fechando vira J/]/l)
 *   - "B)" → "BJ", "B]", "6)", "8)"  (B vira 6 ou 8)
 *   - "C)" → "O)", "OC)", "0)", "C]" (C vira O ou 0)
 *   - "D)" → "DJ", "D]", "0)", "Dl"  (D vira 0)
 *
 * Esta função normaliza esses padrões para a forma canônica "X)" antes do regex parser
 * tentar extrair as alternativas. É **conservadora**: só substitui quando há contexto
 * claro de início de opção (após quebra de linha, pontuação ou múltiplos espaços).
 */
function recoverOcrOptionLabels(text: string): string {
  let out = text;

  // Lookbehind aceita: início de string, quebra de linha, pontuação, ou 2+ espaços.
  // Lookahead aceita qualquer caractere alfanumérico (maiúscula, minúscula ou dígito)
  // — opções podem começar com texto minúsculo ("amoxicilina"), número ("12h"), etc.

  // --- A) ---
  // "AJ ", "A] ", "Al " — A maiúsculo + caractere de cierre OCR-corrupto (J/]/l/|)
  out = out.replace(
    /(^|\n|[.?!;:]\s|\s{2,})A[J\]l|]\s+(?=[A-Za-z0-9ÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç])/g,
    "$1\nA) ",
  );
  // "AJA" — AJ colado sem espaço com palavra (lookahead aceita maiúscula isolada)
  // Captura "AJA vacina", "AJEm 2017", etc. O lookbehind já garante contexto seguro
  // (após pontuação/quebra), evitando match em "MAJ" ou meio de palavra.
  out = out.replace(
    /(^|\n|[.?!;:]\s|\s{2,})A[J\]l|](?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/g,
    "$1\nA) ",
  );

  // --- B) ---
  // "BJ ", "B] " — B maiúsculo + cierre corrupto
  out = out.replace(
    /(^|\n|[.?!;:]\s|\s{2,})B[J\]l|]\s+(?=[A-Za-z0-9ÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç])/g,
    "$1\nB) ",
  );
  // "BJA" — BJ colado sem espaço (lookahead aceita maiúscula isolada)
  out = out.replace(
    /(^|\n|[.?!;:]\s|\s{2,})B[J\]l|](?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/g,
    "$1\nB) ",
  );
  // "6)" como início de opção (após pontuação/quebra) — aceita dígitos também
  out = out.replace(
    /(^|\n|[.?!;:]\s|\s{2,})6\)\s+(?=[A-Za-z0-9ÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç])/g,
    "$1\nB) ",
  );
  // "8)" como início de opção (B confundido com 8) — aceita dígitos também
  out = out.replace(
    /(^|\n|[.?!;:]\s|\s{2,})8\)\s+(?=[A-Za-z0-9ÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç])/g,
    "$1\nB) ",
  );

  // --- C) ---
  // "OC)" — letra duplicada (OCR leu "C)" como "OC)")
  out = out.replace(
    /(^|\n|[.?!;:]\s|\s{2,})OC\)/g,
    "$1\nC)",
  );
  // "O)" como início de opção (em contexto de início de linha)
  out = out.replace(
    /(^|\n|[.?!;:]\s|\s{2,})O\)\s+(?=[A-Za-z0-9ÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç])/g,
    "$1\nC) ",
  );
  // "O " (sem parêntese) iniciando opção — só após ponto+espaço (frase anterior terminou)
  // Lookahead exige token de pelo menos 3 chars (não "O é", "O é", etc.).
  out = out.replace(
    /([.?!]\s)O\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç0-9]{2,})/g,
    "$1\nC) ",
  );

  // --- D) ---
  // "DJ)", "DJ ", "D]", "Dl" — D maiúsculo + cierre corrupto, opcionalmente com ")"
  out = out.replace(
    /(^|\n|[.?!;:]\s|\s{2,})D[J\]l|]\)?\s+(?=[A-Za-z0-9ÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç])/g,
    "$1\nD) ",
  );
  // "DJA" — DJ colado sem espaço (lookahead aceita maiúscula isolada)
  out = out.replace(
    /(^|\n|[.?!;:]\s|\s{2,})D[J\]l|]\)?(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/g,
    "$1\nD) ",
  );

  return out;
}

/**
 * Faz o parse de texto extraído de PDF para um array de questões estruturadas.
 * Resiliente a diferentes formatos: ENAMED / Estratégia MED com áreas,
 * referências e comentários, além de formatos mais simples.
 * Também suporta formato de gabarito comentado (N - YYYY BANCA - CIDADE).
 */
export function parsePdfText(text: string): ParsedQuestion[] {
  const MAX_TEXT_SIZE = 5 * 1024 * 1024;
  if (text.length > MAX_TEXT_SIZE) {
    text = text.slice(0, MAX_TEXT_SIZE);
  }

  // Pré-normalização para tolerar ruído de OCR (palavras quebradas por espaços)
  text = normalizeOcrText(text);
  // Recuperar labels de opções A/B/C/D corrompidas por OCR (AJ → A), OC) → C), etc.)
  text = recoverOcrOptionLabels(text);

  // Normaliza quebras de linha e espaços extras (mantém \n)
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  // -----------------------------------------------------------------------
  // 0. Detectar formato gabarito comentado (N - YYYY BANCA)
  // -----------------------------------------------------------------------
  const gabaritoQuestions = parseGabaritoComentado(normalized);
  if (gabaritoQuestions.length > 0) {
    return gabaritoQuestions;
  }

  // -----------------------------------------------------------------------
  // 1. Detectar áreas de conhecimento e mapear linhas -> área vigente
  // -----------------------------------------------------------------------
  const lines = normalized.split("\n");

  // Mapa: índice de caractere -> área vigente
  // Vamos iterar linhas, rastrear offset e registrar mudanças de área
  type AreaRange = { startOffset: number; area: string };
  const areaRanges: AreaRange[] = [];
  let charOffset = 0;

  for (const line of lines) {
    const detected = detectAreaConhecimento(line);
    if (detected) {
      areaRanges.push({ startOffset: charOffset, area: detected });
    }
    charOffset += line.length + 1; // +1 para o \n
  }

  function areaAtOffset(offset: number): string | undefined {
    let current: string | undefined;
    for (const r of areaRanges) {
      if (r.startOffset <= offset) current = r.area;
      else break;
    }
    return current;
  }

  // -----------------------------------------------------------------------
  // 2. Encontrar todas as posições de início de questão
  // -----------------------------------------------------------------------
  const questionStarts: { index: number; order: number }[] = [];
  let match: RegExpExecArray | null;

  QUESTION_START_RE.lastIndex = 0;
  while ((match = QUESTION_START_RE.exec(normalized)) !== null) {
    const num = parseInt(match[1], 10);
    // Filtro de sanidade: ignora números que parecem ser parte de texto corrido
    // (ex: "67 anos") — só aceita se estiver no começo de linha
    const charBefore = match.index > 0 ? normalized[match.index] : "\n";
    if (charBefore === "\n" || match.index === 0 || /\s/.test(charBefore)) {
      questionStarts.push({ index: match.index, order: num });
    }
  }

  if (questionStarts.length === 0) return [];

  // Ordena por posição no texto (normalmente já está, mas garante)
  questionStarts.sort((a, b) => a.index - b.index);

  const seen = new Set<number>();
  const uniqueStarts = questionStarts.filter(q => {
    if (seen.has(q.order)) return false;
    seen.add(q.order);
    return true;
  });
  questionStarts.length = 0;
  questionStarts.push(...uniqueStarts);

  // -----------------------------------------------------------------------
  // 3. Extrair e parsear cada bloco de questão
  // -----------------------------------------------------------------------
  const questions: ParsedQuestion[] = [];

  for (let i = 0; i < questionStarts.length; i++) {
    const start = questionStarts[i];
    const end =
      i + 1 < questionStarts.length
        ? questionStarts[i + 1].index
        : normalized.length;

    const block = normalized.slice(start.index, end).trim();
    const area = areaAtOffset(start.index);
    const parsed = parseQuestionBlock(block, start.order, area);
    if (parsed) {
      questions.push(parsed);
    }
  }

  // -----------------------------------------------------------------------
  // 4. Tenta aplicar gabarito externo (lista separada no final do texto)
  // -----------------------------------------------------------------------
  applyExternalAnswerKey(normalized, questions);

  return questions;
}

// ---------------------------------------------------------------------------
// Bloco de uma questão
// ---------------------------------------------------------------------------

/**
 * Faz o parse de um bloco de texto contendo uma única questão no formato ENAMED.
 */
function parseQuestionBlock(
  block: string,
  order: number,
  area?: string,
): ParsedQuestion | null {
  // Remove o número/cabeçalho da questão (ex: "1. " ou "Questão 2 – ")
  const headerRe =
    /^\s*(?:quest[aã]o\s+)?\d{1,3}\s*[.):\-–—]\s*/i;
  let body = block.replace(headerRe, "").trim();

  if (!body) return null;

  // ----- Extrair referência (ex: "(Estratégia MED 2025 – ...)") -----
  let reference: string | undefined;
  const refMatch = body.match(REFERENCE_RE);
  if (refMatch) {
    reference = refMatch[1].trim();
    body = body.slice(refMatch[0].length).trim();
  }

  // ----- Separar COMENTÁRIO e Gabarito do corpo -----
  let explanation: string | undefined;
  let correctLabel: string | undefined;

  // Procura bloco COMENTÁRIO
  const comentarioSplit = body.split(COMENTARIO_RE);
  let mainBody: string;

  if (comentarioSplit.length >= 2) {
    mainBody = comentarioSplit[0].trim();
    const afterComentario = comentarioSplit.slice(1).join(" ").trim();

    // Dentro (ou após) o comentário, procurar Gabarito
    const gabMatch = afterComentario.match(GABARITO_RE);
    if (gabMatch) {
      correctLabel = gabMatch[1].toUpperCase();
      // Explicação = tudo antes do Gabarito + tudo depois (raro)
      const gabIdx = afterComentario.indexOf(gabMatch[0]);
      const before = afterComentario.slice(0, gabIdx).trim();
      const after = afterComentario
        .slice(gabIdx + gabMatch[0].length)
        .trim();
      explanation = [before, after].filter(Boolean).join("\n").trim() || undefined;
    } else {
      explanation = afterComentario || undefined;
    }
  } else {
    mainBody = body;

    // Sem bloco COMENTÁRIO explícito — procurar Gabarito diretamente
    const gabMatch = mainBody.match(GABARITO_RE);
    if (gabMatch) {
      correctLabel = gabMatch[1].toUpperCase();
      // Tudo depois do gabarito pode ser explicação
      const gabIdx = mainBody.indexOf(gabMatch[0]);
      const afterGab = mainBody.slice(gabIdx + gabMatch[0].length).trim();
      if (afterGab) explanation = afterGab;
      mainBody = mainBody.slice(0, gabIdx).trim();
    }
  }

  // Também pode haver gabarito no mainBody (antes do COMENTÁRIO)
  if (!correctLabel) {
    const gabInMain = mainBody.match(GABARITO_RE);
    if (gabInMain) {
      correctLabel = gabInMain[1].toUpperCase();
      const idx = mainBody.indexOf(gabInMain[0]);
      mainBody = mainBody.slice(0, idx).trim();
    }
  }

  // ----- Extrair alternativas A) ... D) do mainBody -----
  const options: { label: string; text: string; isCorrect: boolean }[] = [];

  // Encontrar posições de cada alternativa
  const optionPositions: { label: string; contentStart: number }[] = [];

  OPTION_LINE_RE.lastIndex = 0;
  let optMatch: RegExpExecArray | null;
  while ((optMatch = OPTION_LINE_RE.exec(mainBody)) !== null) {
    const label = optMatch[1].toUpperCase();
    // Evitar duplicatas
    if (!optionPositions.find((o) => o.label === label)) {
      optionPositions.push({
        label,
        contentStart: optMatch.index + optMatch[0].length,
      });
    }
  }

  // Extrair texto de cada alternativa (vai até a próxima ou fim do mainBody)
  for (let j = 0; j < optionPositions.length; j++) {
    const opt = optionPositions[j];
    const nextStart =
      j + 1 < optionPositions.length
        ? // Voltar até o início do match da próxima opção
          mainBody.lastIndexOf(
            "\n",
            optionPositions[j + 1].contentStart - 2,
          )
        : mainBody.length;

    // Calcular fim do texto da opção
    let endIdx: number;
    if (j + 1 < optionPositions.length) {
      // Encontrar onde começa a linha da próxima alternativa
      // Procura o padrão "X)" antes do contentStart da próxima
      const nextLabel = optionPositions[j + 1].label;
      const nextRe = new RegExp(
        `(?:^|\\n|[.?!]\\s+|\\s{2,})\\(?\\s*${nextLabel}\\s*[).:\\-–—]\\s*`,
        "gm",
      );
      nextRe.lastIndex = opt.contentStart;
      const nextM = nextRe.exec(mainBody);
      endIdx = nextM ? nextM.index : mainBody.length;
    } else {
      endIdx = mainBody.length;
    }

    const optText = mainBody
      .slice(opt.contentStart, endIdx)
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const finalOptText = optText.length > 500 ? optText.slice(0, 500) + "..." : optText;

    options.push({
      label: opt.label,
      text: finalOptText,
      isCorrect: correctLabel ? opt.label === correctLabel : false,
    });
  }

  // ----- Texto do enunciado: tudo antes da primeira alternativa -----
  let questionText: string;
  if (optionPositions.length > 0) {
    // Encontrar início da linha da primeira alternativa
    const firstLabel = optionPositions[0].label;
    const firstRe = new RegExp(`(?:^|\\n|[.?!]\\s+|\\s{2,})\\(?\\s*${firstLabel}\\s*[).:\\-–—]\\s*`, "m");
    const firstM = mainBody.match(firstRe);
    questionText = firstM
      ? mainBody.slice(0, firstM.index).trim()
      : mainBody.trim();
  } else {
    questionText = mainBody.trim();
  }

  // Re-concatena referência ao texto se ela foi separada
  // (mantemos reference como campo separado, mas o texto fica limpo)
  if (!questionText) return null;

  // Limpa quebras de linha internas no enunciado para um texto corrido
  questionText = questionText.replace(/\n/g, " ").replace(/\s+/g, " ").trim();

  // ----- Detecta imagem -----
  const hasImage = IMAGE_KEYWORDS_RE.test(block);

  // ----- Detectar questão anulada (legitimamente sem gabarito) -----
  const isAnulada = /\banulad[ao]|anula[çc][aã]o|sem\s+resposta\s+correta|n[aã]o\s+h[aá]\s+alternativa\s+(?:que\s+responda\s+)?correta?/i.test(
    `${block} ${explanation ?? ""}`,
  );

  // ----- Fallback agressivo: tenta padrões de gabarito adicionais -----
  // Só roda se a questão NÃO é anulada
  if (!correctLabel && options.length > 0 && !isAnulada) {
    // Procura tanto no block completo quanto na explicação
    const haystack = `${block}\n${explanation ?? ""}`;

    // Mapear letras acentuadas para canônicas (À/Á/Â/Ã → A)
    const ACCENT_MAP: Record<string, string> = {
      "À": "A", "Á": "A", "Â": "A", "Ã": "A",
      "à": "A", "á": "A", "â": "A", "ã": "A",
    };

    // Padrões POSITIVOS — só capturam quando há indicação explícita de "correta"
    // Ordem importa: mais específico primeiro
    const positivePatterns = [
      // "alternativa correta é a letra X" / "alternativa correta: X"
      /alternativa\s+(?:correta|certa)\s*[:.\s]+(?:é\s+)?(?:a\s+)?(?:letra\s+)?([A-DÀÁÂÃa-dàáâã])\b/i,
      // "letra X" + qualquer pontuação/espaço + "correta/certa"
      // Cobre: "letra B é correta", "letra B - correta", "letra B: correta"
      /letra\s+([A-DÀÁÂÃa-dàáâã])\s*[-:.,–—\s]+(?:é\s+)?(?:a\s+)?(?:correta|certa|verdadeira)\b/i,
      // "(letra X - correta)" — variação com parênteses
      /\(\s*letra\s+([A-DÀÁÂÃa-dàáâã])\s*[-:.\s]+(?:correta|certa)/i,
      // "alternativa X é (a) correta"
      /alternativa\s+([A-DÀÁÂÃa-dàáâã])\s+(?:é\s+)?(?:a\s+)?(?:correta|certa|verdadeira)/i,
      // "considerou/banca considerou a alternativa X"
      /(?:banca\s+)?considerou\s+(?:a\s+)?(?:alternativa\s+|letra\s+)?([A-DÀÁÂÃa-dàáâã])\s+(?:como\s+)?(?:correta|certa)?/i,
      // "Resposta: letra X" / "Resposta: X" / "Resposta letra X" / "Gabarito X"
      /(?:gabarito|resposta)\s*[:.]?\s*(?:letra\s+)?([A-DÀÁÂÃa-dàáâã])\b/i,
    ];

    for (const pat of positivePatterns) {
      const m = haystack.match(pat);
      if (m) {
        let cl = m[1].toUpperCase();
        if (ACCENT_MAP[cl]) cl = ACCENT_MAP[cl];
        if (cl !== "A" && cl !== "B" && cl !== "C" && cl !== "D") continue;
        const opt = options.find((o) => o.label === cl);
        if (opt) {
          options.forEach((o) => (o.isCorrect = false));
          opt.isCorrect = true;
          correctLabel = cl;
          break;
        }
      }
    }
  }

  // Limpa explicação (remove possíveis resíduos de gabarito)
  if (explanation) {
    explanation = explanation
      .replace(/Gabarito\s*:\s*[A-Ea-e]/gi, "")
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!explanation) explanation = undefined;
  }

  return {
    order,
    text: questionText,
    options,
    explanation,
    hasImage,
    areaConhecimento: area,
    reference,
  };
}

// ---------------------------------------------------------------------------
// Gabarito externo (lista separada no final do texto)
// ---------------------------------------------------------------------------

/**
 * Tenta aplicar um gabarito externo (lista separada no final do texto).
 * Formato comum: "Gabarito: 1-A, 2-B, 3-C" ou "1. A  2. B  3. C"
 */
function applyExternalAnswerKey(
  fullText: string,
  questions: ParsedQuestion[],
): void {
  // Procura seção de gabarito no final
  const gabaritoMatch = fullText.match(
    /(?:gabarito|respostas?|chave de corre[çc][aã]o)\s*:?\s*\n?([\s\S]{5,})$/i,
  );
  if (!gabaritoMatch) return;

  const gabaritoSection = gabaritoMatch[1];

  // Verifica se parece uma lista de gabaritos (muitos "N-X" ou "N. X")
  const entryPattern = /(\d{1,3})\s*[.):\-–—]\s*([A-Ea-e])/gi;
  const entries: { order: number; label: string }[] = [];
  let entry: RegExpExecArray | null;

  while ((entry = entryPattern.exec(gabaritoSection)) !== null) {
    entries.push({
      order: parseInt(entry[1], 10),
      label: entry[2].toUpperCase(),
    });
  }

  // Só aplica se encontrou pelo menos 2 entradas (evita falso positivo)
  if (entries.length < 2) return;

  for (const e of entries) {
    const question = questions.find((q) => q.order === e.order);
    if (question) {
      question.options.forEach((o) => (o.isCorrect = false));
      const opt = question.options.find((o) => o.label === e.label);
      if (opt) opt.isCorrect = true;
    }
  }
}
