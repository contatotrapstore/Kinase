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
const OPTION_LINE_RE = /(?:^|\n)\s*\(?\s*([A-Ea-e])\s*[).:\-–—]\s*/gi;

/**
 * Regex para o bloco COMENTÁRIO (pode usar acento ou não)
 */
const COMENTARIO_RE = /\n\s*COMENT[AÁ]RIO\s*:\s*/i;

/**
 * Regex para gabarito inline
 */
const GABARITO_RE = /Gabarito\s*:\s*([A-Da-d])/i;

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
const RESPOSTA_LETRA_RE = /Resposta:\s*letra\s+([A-Ea-e])/i;

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

    // Remover "Video comentário: NNNNN" e tudo depois
    const cleanCommentary = commentary
      .replace(/Video\s*coment[aá]rio:?\s*\d*/gi, "")
      .replace(/Resposta:\s*letra\s+[A-Ea-e]\.?/gi, "")
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Tentar extrair alternativas inline
    const options: ParsedQuestion["options"] = [];

    INLINE_ALT_RE.lastIndex = 0;
    let altMatch: RegExpExecArray | null;
    while ((altMatch = INLINE_ALT_RE.exec(commentary)) !== null) {
      const label = altMatch[1].toUpperCase();
      if (!options.find((o) => o.label === label)) {
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
          options.push({ label, text: "", isCorrect });
        }
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

    questions.push({
      order: header.order,
      text: cleanCommentary,
      options,
      explanation: cleanCommentary,
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
 * Faz o parse de texto extraído de PDF para um array de questões estruturadas.
 * Resiliente a diferentes formatos: ENAMED / Estratégia MED com áreas,
 * referências e comentários, além de formatos mais simples.
 * Também suporta formato de gabarito comentado (N - YYYY BANCA - CIDADE).
 */
export function parsePdfText(text: string): ParsedQuestion[] {
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
        `(?:^|\\n)\\s*\\(?\\s*${nextLabel}\\s*[).:\\-–—]\\s*`,
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

    options.push({
      label: opt.label,
      text: optText,
      isCorrect: correctLabel ? opt.label === correctLabel : false,
    });
  }

  // ----- Texto do enunciado: tudo antes da primeira alternativa -----
  let questionText: string;
  if (optionPositions.length > 0) {
    // Encontrar início da linha da primeira alternativa
    const firstLabel = optionPositions[0].label;
    const firstRe = new RegExp(`(?:^|\\n)\\s*\\(?\\s*${firstLabel}\\s*[).:\\-–—]\\s*`, "m");
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

  // ----- Fallback: tenta padrões de gabarito adicionais -----
  if (!correctLabel && options.length > 0) {
    // Procura no bloco completo por padrões alternativos
    const altPatterns = [
      /(?:gabarito|resposta|alternativa correta)\s*:?\s*([A-Da-d])/i,
      /\b(?:letra|alternativa)\s+([A-Da-d])\b/i,
    ];
    for (const pat of altPatterns) {
      const m = block.match(pat);
      if (m) {
        const cl = m[1].toUpperCase();
        const opt = options.find((o) => o.label === cl);
        if (opt) {
          options.forEach((o) => (o.isCorrect = false));
          opt.isCorrect = true;
        }
        break;
      }
    }
  }

  // Limpa explicação (remove possíveis resíduos de gabarito)
  if (explanation) {
    explanation = explanation
      .replace(/Gabarito\s*:\s*[A-Da-d]/gi, "")
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
  const entryPattern = /(\d{1,3})\s*[.):\-–—]\s*([A-Da-d])/gi;
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
