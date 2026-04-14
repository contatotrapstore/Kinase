import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildRanking,
  buildComparativeRanking,
  type RankingEntry,
} from "@/lib/ranking/calculator";

/**
 * GET /api/ranking?pacoteId=xxx&userId=yyy
 * Retorna ranking real de usuários para um pacote.
 * Se userId fornecido, usa ranking comparativo centrado nesse usuário.
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

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any;

    // Busca rankings com join em usuarios
    const { data, error } = await supabase
      .from("rankings")
      .select("usuario_id, total_score, total_correct, total_answered, accuracy_pct, usuarios(name, phone)")
      .eq("pacote_id", pacoteId)
      .order("total_score", { ascending: false });

    if (error) {
      console.error("[api/ranking] Erro Supabase:", error);
      return NextResponse.json(
        { error: "Erro ao buscar ranking" },
        { status: 500 }
      );
    }

    const entries: Omit<RankingEntry, "position">[] = (data ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (row: any) => ({
        userId: row.usuario_id,
        userName: row.usuarios?.name ?? row.usuarios?.phone?.slice(-4) ?? "Anônimo",
        totalScore: row.total_score ?? 0,
        totalCorrect: row.total_correct ?? 0,
        totalAnswered: row.total_answered ?? 0,
        accuracyPct: Number(row.accuracy_pct ?? 0),
      })
    );

    let ranking: RankingEntry[];
    if (userId) {
      const fullRanking = buildRanking(entries);
      ranking = buildComparativeRanking(fullRanking, userId);
    } else {
      ranking = buildRanking(entries);
    }

    return NextResponse.json({
      ranking,
      total: ranking.length,
    });
  } catch (err) {
    console.error("[api/ranking] Erro interno:", err);
    return NextResponse.json(
      { error: "Erro interno ao buscar ranking" },
      { status: 500 }
    );
  }
}
