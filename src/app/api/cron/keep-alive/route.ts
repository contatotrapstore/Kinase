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

    // Mantém Free Tier ativo
    const { error } = await supabase
      .from("areas_conhecimento")
      .select("id")
      .limit(1);
    if (error) {
      console.error("[cron/keep-alive] Erro Supabase:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Job pós-envio: marca lembretes que tiveram retorno (resposta em 24h)
    // Roda 1x/dia (cron 0 3 * * *), olha envios das ultimas 48h
    const cutoffEnvios = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: pendentes } = await supabase
      .from('motivacional_envios')
      .select('id, usuario_id, sent_at, usuarios!inner(phone)')
      .eq('respondeu_apos', false)
      .gte('sent_at', cutoffEnvios);

    let marcados = 0;
    for (const env of (pendentes ?? []) as any[]) {
      const sentAt = new Date(env.sent_at);
      const cutoff24h = new Date(sentAt.getTime() + 24 * 60 * 60 * 1000).toISOString();
      const phone = env.usuarios?.phone;
      if (!phone) continue;
      const { data: resp } = await supabase
        .from('whatsapp_log')
        .select('received_at')
        .eq('parsed_phone', phone)
        .eq('action', 'received')
        .gte('received_at', env.sent_at)
        .lte('received_at', cutoff24h)
        .order('received_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (resp?.received_at) {
        await supabase
          .from('motivacional_envios')
          .update({ respondeu_apos: true, respondeu_em: resp.received_at })
          .eq('id', env.id);
        marcados += 1;
      }
    }

    return NextResponse.json({ ok: true, ts: new Date().toISOString(), lembretes_marcados: marcados });
  } catch (err) {
    console.error("[cron/keep-alive] Erro:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
