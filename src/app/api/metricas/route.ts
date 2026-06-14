import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin, UnauthorizedError } from "@/lib/auth/require-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/metricas — agrega todas as views de métricas do dashboard.
 * Query: ?grupo=X — filtra v_ultima_atividade por grupo_experimental.
 * Auth: requer sessão admin.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }

  const grupo = request.nextUrl.searchParams.get("grupo");
  const supabase = createServiceClient();

  // Disparo paralelo de todas as views
  const ultimaAtividadeQuery = grupo && grupo !== "todos"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? (supabase.from("v_ultima_atividade" as any).select("*").eq("grupo_experimental", grupo))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    : (supabase.from("v_ultima_atividade" as any).select("*"));

  const [
    uso,
    questoes,
    retencao,
    lembretes,
    dificuldade,
    comandos,
    explicacoes,
    ultimaAtividade,
    grupos,
  ] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase.from("v_metricas_uso" as any).select("*").order("dia", { ascending: true }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase.from("v_metricas_questoes" as any).select("*").single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase.from("v_retencao" as any).select("*").order("cohort", { ascending: true }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase.from("v_metricas_lembretes" as any).select("*").order("dia", { ascending: true }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase.from("v_dificuldade_acerto" as any).select("*"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase.from("v_uso_comandos" as any).select("*").order("total_usos", { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase.from("v_explicacoes_rating" as any).select("*").single(),
    ultimaAtividadeQuery.order("ultima_interacao", { ascending: false, nullsFirst: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase.from("usuarios" as any).select("grupo_experimental").not("grupo_experimental", "is", null),
  ]);

  const errors = [uso, questoes, retencao, lembretes, dificuldade, comandos, explicacoes, ultimaAtividade, grupos]
    .map((r) => r.error)
    .filter(Boolean);

  if (errors.length > 0) {
    console.error("[metricas:GET] erros:", errors);
  }

  // Lista única de grupos para o filtro
  const gruposUnicos = Array.from(
    new Set(
      ((grupos.data ?? []) as Array<{ grupo_experimental: string | null }>)
        .map((g) => g.grupo_experimental)
        .filter((g): g is string => !!g),
    ),
  ).sort();

  return NextResponse.json(
    {
      uso: uso.data ?? [],
      questoes: questoes.data ?? null,
      retencao: retencao.data ?? [],
      lembretes: lembretes.data ?? [],
      dificuldade: dificuldade.data ?? [],
      comandos: comandos.data ?? [],
      explicacoes: explicacoes.data ?? null,
      ultimaAtividade: ultimaAtividade.data ?? [],
      grupos: gruposUnicos,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
