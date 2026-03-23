// ============================================================
// Ranking Calculator — Construção e formatação do ranking Kinase
// ============================================================

/** Entrada completa do ranking (com posição) */
export interface RankingEntry {
  userId: string;
  userName: string;
  totalScore: number;
  totalCorrect: number;
  totalAnswered: number;
  accuracyPct: number;
  position: number;
}

/**
 * Ordena as entradas por pontuação (desc) e acurácia (desc),
 * e atribui posições sequenciais (empates recebem mesma posição).
 */
export function buildRanking(
  entries: Omit<RankingEntry, 'position'>[],
): RankingEntry[] {
  // Ordena por pontuação descrescente, depois acurácia descrescente
  const sorted = [...entries].sort((a, b) => {
    if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore;
    }
    return b.accuracyPct - a.accuracyPct;
  });

  const ranked: RankingEntry[] = [];
  let currentPosition = 1;

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];

    // Se não é o primeiro e tem mesma pontuação + acurácia, mantém posição
    if (
      i > 0 &&
      entry.totalScore === sorted[i - 1].totalScore &&
      entry.accuracyPct === sorted[i - 1].accuracyPct
    ) {
      ranked.push({ ...entry, position: ranked[i - 1].position });
    } else {
      ranked.push({ ...entry, position: currentPosition });
    }

    currentPosition = i + 2; // Próxima posição possível (1-based)
  }

  return ranked;
}

/**
 * Constrói um ranking comparativo: filtra apenas usuários que responderam
 * >= o mesmo número de questões que o usuário-alvo, ordena por score desc
 * e acurácia desc, e atribui posições.
 */
export function buildComparativeRanking(
  entries: RankingEntry[],
  targetUserId: string,
): RankingEntry[] {
  const targetEntry = entries.find((e) => e.userId === targetUserId);
  if (!targetEntry) return [];

  const minAnswered = targetEntry.totalAnswered;

  // Filtra apenas quem respondeu >= o mesmo número de questões
  const filtered = entries.filter((e) => e.totalAnswered >= minAnswered);

  // Ordena por score desc, acurácia desc
  const sorted = [...filtered].sort((a, b) => {
    if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore;
    }
    return b.accuracyPct - a.accuracyPct;
  });

  // Atribui posições (empates recebem mesma posição)
  const ranked: RankingEntry[] = [];
  let currentPosition = 1;

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];

    if (
      i > 0 &&
      entry.totalScore === sorted[i - 1].totalScore &&
      entry.accuracyPct === sorted[i - 1].accuracyPct
    ) {
      ranked.push({ ...entry, position: ranked[i - 1].position });
    } else {
      ranked.push({ ...entry, position: currentPosition });
    }

    currentPosition = i + 2;
  }

  return ranked;
}

/**
 * Formata o ranking para exibição no WhatsApp (texto simples com emojis).
 * @param ranking Lista já ordenada com posições
 * @param topN Quantidade de usuários a exibir (padrão: todos)
 */
export function formatRankingMessage(
  ranking: RankingEntry[],
  topN?: number,
): string {
  const entries = topN ? ranking.slice(0, topN) : ranking;

  if (entries.length === 0) {
    return '📊 *Ranking Kinase*\n\nNenhum participante ainda.';
  }

  const medalhas: Record<number, string> = {
    1: '🥇',
    2: '🥈',
    3: '🥉',
  };

  const lines = entries.map((entry) => {
    const medal = medalhas[entry.position] ?? `${entry.position}º`;
    const name = entry.userName ? `Dr. ${entry.userName}` : 'Dr.';
    const accuracy = entry.accuracyPct.toFixed(1);

    return `${medal} *${name}* — ${entry.totalScore} pts (${accuracy}% acerto)`;
  });

  const header = '📊 *Ranking Kinase*\n';
  const separator = '─'.repeat(24);

  return `${header}${separator}\n${lines.join('\n')}`;
}
