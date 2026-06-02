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

    // Window: cron roda toda hora entre 11h-23h UTC (= 8h-20h Brasília).
    // Pra cada user elegível, sorteia se manda agora (prob = 1/horas_restantes).
    // Resultado: cada user recebe 1x/dia em horário aleatório dentro do range.
    const nowUtc = new Date();
    const hourUtc = nowUtc.getUTCHours();
    const START_HOUR = 11;
    const END_HOUR = 23;
    if (hourUtc < START_HOUR || hourUtc > END_HOUR) {
      return NextResponse.json({ ok: true, skipped: 'fora do range 11-23 UTC' });
    }
    const horasRestantes = END_HOUR - hourUtc + 1; // inclui hora atual
    const probabilidade = 1 / horasRestantes;
    const ehUltimaHora = hourUtc === END_HOUR;

    // Cutoff: ultima resposta/atualizacao ha mais de 24h
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    // Cutoff: nao enviar mais de 1x por dia (24h desde ultima motivacional)
    const cutoffEnvio = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

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
    let skipped_dice = 0;

    for (const row of (stale ?? []) as any[]) {
      const usuario = row.usuarios;
      if (!usuario?.phone) continue;

      // Skip se ja enviou nas ultimas 24h (anti-spam)
      if (usuario.last_motivacional_sent_at && usuario.last_motivacional_sent_at > cutoffEnvio) {
        skipped_recent += 1;
        continue;
      }

      // Sorteio: na ultima hora envia certo; senao roleta com prob = 1/horas_restantes
      const sortou = ehUltimaHora || Math.random() < probabilidade;
      if (!sortou) {
        skipped_dice += 1;
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
      hora_utc: hourUtc,
      probabilidade: probabilidade.toFixed(2),
      candidatos: stale?.length ?? 0,
      sent,
      failed,
      skipped_recent,
      skipped_dice,
    });
  } catch (err) {
    console.error("[cron/motivacional] erro:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
