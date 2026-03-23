import { NextRequest, NextResponse } from "next/server";
import {
  buildRanking,
  buildComparativeRanking,
  type RankingEntry,
} from "@/lib/ranking/calculator";

const mockDoctors: Omit<RankingEntry, "position">[] = [
  { userId: "u1", userName: "Dr. Ana Ferreira", totalScore: 950, totalCorrect: 47, totalAnswered: 50, accuracyPct: 94.0 },
  { userId: "u2", userName: "Dr. Carlos Mendes", totalScore: 920, totalCorrect: 45, totalAnswered: 50, accuracyPct: 90.0 },
  { userId: "u3", userName: "Dr. Beatriz Lima", totalScore: 890, totalCorrect: 44, totalAnswered: 50, accuracyPct: 88.0 },
  { userId: "u4", userName: "Dr. Daniel Souza", totalScore: 860, totalCorrect: 42, totalAnswered: 50, accuracyPct: 84.0 },
  { userId: "u5", userName: "Dr. Elena Rocha", totalScore: 840, totalCorrect: 41, totalAnswered: 50, accuracyPct: 82.0 },
  { userId: "u6", userName: "Dr. Felipe Alves", totalScore: 810, totalCorrect: 39, totalAnswered: 48, accuracyPct: 81.3 },
  { userId: "u7", userName: "Dr. Gabriela Costa", totalScore: 780, totalCorrect: 38, totalAnswered: 48, accuracyPct: 79.2 },
  { userId: "u8", userName: "Dr. Henrique Dias", totalScore: 750, totalCorrect: 36, totalAnswered: 47, accuracyPct: 76.6 },
  { userId: "u9", userName: "Dr. Isabela Martins", totalScore: 720, totalCorrect: 35, totalAnswered: 47, accuracyPct: 74.5 },
  { userId: "u10", userName: "Dr. Jorge Oliveira", totalScore: 690, totalCorrect: 33, totalAnswered: 46, accuracyPct: 71.7 },
];

/**
 * GET /api/ranking?pacoteId=xxx&userId=yyy
 * Retorna ranking de usuários. Se userId fornecido, usa ranking comparativo.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pacoteId = searchParams.get("pacoteId");
  const userId = searchParams.get("userId");

  if (!pacoteId) {
    return NextResponse.json(
      { error: "pacoteId é obrigatório" },
      { status: 400 }
    );
  }

  let ranking: RankingEntry[];

  if (userId) {
    // Primeiro constrói ranking completo, depois filtra comparativo
    const fullRanking = buildRanking(mockDoctors);
    ranking = buildComparativeRanking(fullRanking, userId);
  } else {
    ranking = buildRanking(mockDoctors);
  }

  return NextResponse.json({
    ranking,
    total: ranking.length,
  });
}
