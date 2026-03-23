// ============================================================
// QBL Scoring — Cálculo de ranking e comparação de usuários
// ============================================================

/** Entrada de ranking por usuário */
export interface RankingEntry {
  totalCorrect: number;
  totalAnswered: number;
  accuracy: number;
  score: number;
}

/**
 * Calcula o ranking a partir de uma lista de respostas.
 * Agrupa por userId e retorna um Map com as estatísticas.
 */
export function calculateRanking(
  answers: { studentId: string; isCorrect: boolean }[],
): Map<string, RankingEntry> {
  const map = new Map<string, RankingEntry>();

  for (const answer of answers) {
    const existing = map.get(answer.studentId) ?? {
      totalCorrect: 0,
      totalAnswered: 0,
      accuracy: 0,
      score: 0,
    };

    existing.totalAnswered += 1;
    if (answer.isCorrect) {
      existing.totalCorrect += 1;
    }

    // Recalcula acurácia e pontuação
    existing.accuracy =
      existing.totalAnswered > 0
        ? Math.round((existing.totalCorrect / existing.totalAnswered) * 10000) / 100
        : 0;
    existing.score = existing.totalCorrect * 10;

    map.set(answer.studentId, existing);
  }

  return map;
}

/**
 * Compara dois usuários para ordenação no ranking.
 * Critério: maior pontuação primeiro; empate → maior acurácia primeiro.
 */
export function compareStudents(a: RankingEntry, b: RankingEntry): number {
  if (b.score !== a.score) {
    return b.score - a.score;
  }
  return b.accuracy - a.accuracy;
}
