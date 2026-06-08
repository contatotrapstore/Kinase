import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ZApiWhatsAppAdapter } from "@/lib/whatsapp/zapi";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/cron/motivacional
 * Detecta usuarios com progresso ativo cuja ultima resposta foi > 24h
 * atras (ou que ainda nao responderam apos /start) e envia uma mensagem
 * motivacional leve via WhatsApp.
 *
 * Configurado em vercel.json. Tom: profissional + leve. Aleatoriza entre
 * varias frases pra nao soar robotico.
 */
const MENSAGENS = [
  "Dr(a), suas questões de hoje estão te esperando! Que tal 2 minutinhos de prática agora? 📚",
  "Faz um tempinho que não te vejo por aqui. Bora manter o ritmo dos estudos? 💪",
  "Sua evolução depende da constância. Manda uma letra (A/B/C/D) e seguimos pra próxima! 🚀",
  "Constância vence talento. Volta aqui e responde mais uma — leva menos de 1 minuto. 🔥",
  "Que tal revisar uma questão hoje? Seu eu do dia da prova agradece. 🙌",
  "Bora reativar os estudos? Manda qualquer letra que eu te envio uma questão na hora.",
];

export async function GET() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceClient() as any;

    // Invocado por Supabase pg_cron 2x/dia (14h e 22h UTC = 11h e 19h Brasília).
    // Throttle: 1 mensagem por user a cada 12h (evita 2x no mesmo dia se rede falhar).
    const nowUtc = new Date();
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const cutoffEnvio = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

    const { data: stale, error: queryErr } = await supabase
      .from("progresso_usuario")
      .select("usuario_id, updated_at, usuarios!inner(id, phone, last_motivacional_sent_at)")
      .eq("status", "in_progress")
      .lt("updated_at", cutoff24h);

    if (queryErr) {
      console.error("[cron/motivacional] erro query:", queryErr);
      return NextResponse.json({ ok: false, error: queryErr.message }, { status: 500 });
    }

    const adapter = new ZApiWhatsAppAdapter({
      instanceId: env.ZAPI_INSTANCE_ID,
      token: env.ZAPI_TOKEN,
      securityToken: env.WHATSAPP_API_TOKEN,
    });

    let sent = 0;
    let failed = 0;
    let skipped_recent = 0;

    for (const row of (stale ?? []) as any[]) {
      const usuario = row.usuarios;
      if (!usuario?.phone) continue;

      // Throttle: 1 mensagem por user a cada 12h
      if (usuario.last_motivacional_sent_at && usuario.last_motivacional_sent_at > cutoffEnvio) {
        skipped_recent += 1;
        continue;
      }

      const msg = MENSAGENS[Math.floor(Math.random() * MENSAGENS.length)];
      try {
        await adapter.sendText(usuario.phone, msg);
        await supabase
          .from("usuarios")
          .update({ last_motivacional_sent_at: new Date().toISOString() })
          .eq("id", usuario.id);
        sent += 1;
      } catch (e) {
        console.error(`[motivacional] falha pra ${usuario.phone}:`, e);
        failed += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      ts: nowUtc.toISOString(),
      candidatos: stale?.length ?? 0,
      sent,
      failed,
      skipped_recent,
    });
  } catch (err) {
    console.error("[cron/motivacional] erro:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
