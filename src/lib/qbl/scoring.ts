// ============================================================
// QBL Scoring — Types for ranking entries
// ============================================================

/** Entrada de ranking por usuário */
export interface RankingEntry {
  totalCorrect: number;
  totalAnswered: number;
  accuracy: number;
  score: number;
}
