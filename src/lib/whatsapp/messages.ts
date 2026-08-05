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
    '2. Responda com a letra: *A*, *B*, *C*, *D* ou *E*',
    '3. Avalie a dificuldade: *F* (Fácil) / *M* (Médio) / *D* (Difícil)',
    '4. Receba feedback com explicação',
    '5. Questões erradas voltam para revisão no próximo bloco',
    '',
    '*Comandos disponíveis:*',
    '/ranking — Ver ranking comparativo',
    '/progresso — Ver seu progresso atual',
    '/restart — Zerar seu progresso e recomeçar',
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
    '/start ou /iniciar — Continuar de onde parou',
    '/restart ou /reiniciar — Zerar e começar do início',
    '/ranking — Ver ranking comparativo',
    '/progresso — Ver seu progresso atual',
    '/ajuda ou /help — Ver esta mensagem',
    'SAIR — Apagar seus dados e parar de receber mensagens',
    '',
    '*Para responder questões:*',
    'Envie apenas a letra da alternativa: *A*, *B*, *C* ou *D*',
  ].join('\n');
}

/**
 * Primeiro passo do opt-out (LGPD art. 18). Explica o alcance da exclusão e pede
 * confirmação — não apaga nada. A exclusão só ocorre com "SAIR CONFIRMO".
 */
export function exitConfirmMessage(): string {
  return [
    '*Você pediu para sair.*',
    '',
    'Se confirmar, apagamos tudo o que temos de você: seu número, suas respostas,',
    'seu progresso e o histórico das suas mensagens.',
    '',
    '*Isso não tem volta.* Não guardamos cópia e não conseguimos restaurar depois.',
    '',
    'Para confirmar, envie: *SAIR CONFIRMO*',
    'Para continuar estudando, é só responder a próxima questão.',
  ].join('\n');
}

/**
 * Exclusão concluída com sucesso.
 */
export function exitDoneMessage(): string {
  return [
    '*Pronto. Seus dados foram apagados.*',
    '',
    'Não temos mais nenhum registro seu e você não receberá mais mensagens.',
    '',
    'Se um dia quiser voltar, envie */start* — recomeçamos do zero.',
    'Obrigado por ter participado.',
  ].join('\n');
}

/**
 * Conta apagada, mas o histórico bruto de mensagens permaneceu. Quem pediu exclusão
 * precisa saber que ficou uma parte, e como cobrar o resto.
 */
export function exitPartialMessage(): string {
  return [
    '*Sua conta foi apagada* e você não receberá mais mensagens.',
    '',
    'Uma parte do histórico de mensagens não pôde ser removida agora.',
    'Responda a este número pedindo a exclusão do histórico, ou escreva para o',
    'nosso contato de privacidade — vamos concluir manualmente.',
  ].join('\n');
}

/**
 * Falha no meio da exclusão. Pode ter apagado parte — não afirmar que nada saiu,
 * nem que tudo saiu. Reenviar SAIR CONFIRMO retoma de onde parou.
 */
export function exitFailedMessage(): string {
  return [
    '*Não conseguimos concluir a exclusão agora.*',
    '',
    'Parte dos seus dados pode já ter sido apagada, e o pedido não se perdeu.',
    'Envie *SAIR CONFIRMO* de novo em alguns minutos — retomamos de onde parou.',
    'Se continuar falhando, escreva para o nosso contato de privacidade.',
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
  source?: string | null,
): string {
  const header = `*Questão ${number}*`;
  const optionLines = options
    .map((o) => `*${o.label})* ${o.text}`)
    .join('\n');

  const lines = [header];
  if (source && source.trim()) {
    lines.push(`_${source.trim()}_`);
  }
  // Rodapé adaptado ao formato da questão
  const labels = options.map((o) => o.label);
  let footer: string;
  if (labels.length === 2 && labels.includes('C') && labels.includes('E')) {
    footer = '_Responda *C* (Certo) ou *E* (Errado)_';
  } else {
    footer = `_Mande sua resposta: ${labels.join(', ').replace(/, ([^,]+)$/, ' ou $1')}_`;
  }
  lines.push('', text, '', optionLines, '', footer);
  return lines.join('\n');
}

/**
 * Pergunta a dificuldade percebida da questão (F/M/D) ANTES de mostrar o feedback.
 * Usado depois que o usuário responde A/B/C/D/E e antes do gabarito ser revelado.
 */
export function askDifficultyMessage(): string {
  return [
    '*Como você avaliou essa questão?*',
    '',
    '*F* — Fácil',
    '*M* — Médio',
    '*D* — Difícil',
    '',
    '_Sua avaliação ajuda a calibrar a dificuldade pra próximas questões._',
  ].join('\n');
}

/**
 * Resposta quando o usuário envia letra inválida no momento da avaliação F/M/D.
 */
export function invalidDifficultyMessage(): string {
  return 'Responda apenas *F* (Fácil), *M* (Médio) ou *D* (Difícil) para avaliar a questão.';
}

/**
 * Formata a mensagem de feedback após o usuário responder uma questão.
 * @param isCorrect - Se a resposta estava correta
 * @param explanation - Explicação da resposta correta
 * @param correctOption - Alternativa correta (mostrada quando o usuário erra)
 */
export function feedbackMessage(
  isCorrect: boolean,
  explanation: string,
  correctOption?: { label: string; text: string } | null,
): string {
  const header = isCorrect ? 'Acertou! ✅' : 'Errou! ❌';
  const lines: string[] = [`*${header}*`, ''];

  // Quando erra, sempre mostrar qual era a correta — sem isso o usuário não aprende
  if (!isCorrect && correctOption) {
    lines.push(`*Resposta correta:* *${correctOption.label})* ${correctOption.text}`);
    lines.push('');
  }

  const hasExplanation = explanation && explanation.trim().length > 0;
  if (hasExplanation) {
    lines.push(explanation);
  }
  // Sem fallback negativo: se não tem comentário, simplesmente omite a linha

  if (!isCorrect) {
    lines.push('');
    lines.push('_Esta questão voltará para revisão._');
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
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
