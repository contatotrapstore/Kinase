// ============================================================
// Message Templates — Mensagens formatadas para WhatsApp
// Usa formatação WhatsApp: *negrito*, _itálico_, ~tachado~
// ============================================================

/**
 * Mensagem de boas-vindas enviada ao usuário no primeiro contato.
 * Explica o funcionamento da plataforma e os comandos disponíveis.
 */
export function welcomeMessage(): string {
  return [
    '*Bem-vindo ao Kinase!* 🧬',
    '',
    'Aqui você aprende por *microlearning* — questões curtas enviadas diretamente no WhatsApp.',
    '',
    '*Como funciona:*',
    '1. Você recebe questões de múltipla escolha',
    '2. Responda com a letra: *A*, *B*, *C* ou *D*',
    '3. Receba feedback imediato com explicação',
    '4. Questões erradas voltam para revisão',
    '5. Avance pelos blocos progressivos',
    '',
    '*Comandos disponíveis:*',
    '/ranking — Ver ranking comparativo',
    '/progresso — Ver seu progresso atual',
    '/ajuda — Ver esta lista de comandos',
    '',
    'Vamos começar! Sua primeira questão está a caminho.',
  ].join('\n');
}

/**
 * Mensagem de ajuda com todos os comandos disponíveis.
 */
export function helpMessage(): string {
  return [
    '*Comandos disponíveis:* 📋',
    '',
    '/start ou /iniciar — Iniciar ou reiniciar',
    '/ranking — Ver ranking comparativo',
    '/progresso — Ver seu progresso atual',
    '/ajuda ou /help — Ver esta mensagem',
    '',
    '*Para responder questões:*',
    'Envie apenas a letra da alternativa: *A*, *B*, *C* ou *D*',
  ].join('\n');
}

/**
 * Formata uma questão de múltipla escolha para envio no WhatsApp.
 * @param number - Número sequencial da questão no bloco
 * @param text - Enunciado da questão
 * @param options - Alternativas com label (A/B/C/D) e texto
 */
export function questionMessage(
  number: number,
  text: string,
  options: { label: string; text: string }[],
): string {
  const header = `*Questão ${number}*`;
  const optionLines = options
    .map((o) => `*${o.label})* ${o.text}`)
    .join('\n');

  return [
    header,
    '',
    text,
    '',
    optionLines,
    '',
    '_Responda com a letra: A, B, C ou D_',
  ].join('\n');
}

/**
 * Formata a mensagem de feedback após o usuário responder uma questão.
 * @param isCorrect - Se a resposta estava correta
 * @param explanation - Explicação da resposta correta
 */
export function feedbackMessage(isCorrect: boolean, explanation: string): string {
  const header = isCorrect
    ? 'Acertou! ✅'
    : 'Errou! ❌';

  const retryNote = isCorrect
    ? ''
    : '\n_Esta questão voltará para revisão._';

  return [
    `*${header}*`,
    '',
    explanation || 'Sem explicação disponível.',
    retryNote,
  ].filter(Boolean).join('\n');
}

/**
 * Formata a mensagem de ranking para envio no WhatsApp.
 * Recebe o ranking já formatado pelo calculator e adiciona envelope.
 * @param ranking - Texto do ranking já formatado por formatRankingMessage()
 */
export function rankingMessage(ranking: string): string {
  return ranking;
}

/**
 * Formata a mensagem de progresso do usuário.
 * @param current - Número de questões respondidas
 * @param total - Total de questões no bloco
 * @param score - Pontuação acumulada
 */
export function progressMessage(
  current: number,
  total: number,
  score: number,
): string {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  const bar = progressBar(pct);

  return [
    '*Seu progresso* 📈',
    '',
    `Questões: ${current}/${total}`,
    `Progresso: ${bar} ${pct}%`,
    `Pontuação: *${score} pts*`,
  ].join('\n');
}

/**
 * Gera uma barra de progresso visual com caracteres Unicode.
 * @param percent - Percentual de 0 a 100
 */
function progressBar(percent: number): string {
  const filled = Math.round(percent / 10);
  const empty = 10 - filled;
  return '▓'.repeat(filled) + '░'.repeat(empty);
}
