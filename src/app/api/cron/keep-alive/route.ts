import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const maxDuration = 10;

/**
 * GET /api/cron/keep-alive
 * Faz uma query trivial no Supabase para manter o projeto Free Tier ativo.
 * Configurado em vercel.json com schedule "0 *\/6 * * *" (a cada 6 horas).
 *
 * Supabase Free pausa após 7 dias sem atividade — uma query a cada 6h
 * garante que o projeto nunca pausa, evitando perda de dados em restore.
 */
export async function GET() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceClient() as any;
    const { error } = await supabase
      .from("areas_conhecimento")
      .select("id")
      .limit(1);

    if (error) {
      console.error("[cron/keep-alive] Erro Supabase:", error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, ts: new Date().toISOString() });
  } catch (err) {
    console.error("[cron/keep-alive] Erro:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
