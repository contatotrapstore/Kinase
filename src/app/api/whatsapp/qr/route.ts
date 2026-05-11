import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { requireAdmin, UnauthorizedError } from "@/lib/auth/require-admin";

export const runtime = "nodejs";
export const maxDuration = 10;

/**
 * GET /api/whatsapp/qr
 * Retorna o QR Code da instância Z-API atual (se desconectada).
 * Admin only — usado pela página /admin/whatsapp para exibir o QR.
 *
 * Resposta (JSON):
 *   { qrBase64: string }   se desconectado e tem QR
 *   { connected: true }     se já conectado (não precisa QR)
 *   { error: string }       em caso de falha
 */
export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }

  const instanceId = env.ZAPI_INSTANCE_ID;
  const token = env.ZAPI_TOKEN;
  const clientToken = env.WHATSAPP_API_TOKEN;

  if (!instanceId || !token || !clientToken) {
    return NextResponse.json(
      { error: "Z-API credentials não configuradas" },
      { status: 500 },
    );
  }

  const baseUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}`;

  try {
    // 1. Verificar se já está conectada
    const meRes = await fetch(`${baseUrl}/me`, {
      headers: { "Client-Token": clientToken },
    });
    const meData = await meRes.json().catch(() => ({}));
    if (meData?.connected === true) {
      return NextResponse.json({ connected: true });
    }

    // 2. Buscar QR — Z-API expõe /qr-code que retorna { value: "data:image/png;base64,..." }
    const qrRes = await fetch(`${baseUrl}/qr-code`, {
      headers: { "Client-Token": clientToken },
    });

    if (!qrRes.ok) {
      return NextResponse.json(
        { error: `Z-API QR endpoint retornou ${qrRes.status}` },
        { status: 502 },
      );
    }

    const qrData = await qrRes.json();
    if (!qrData?.value) {
      return NextResponse.json(
        { error: "QR não disponível (instância pode estar conectando)" },
        { status: 503 },
      );
    }

    return NextResponse.json({
      connected: false,
      qrBase64: qrData.value,
    });
  } catch (err) {
    console.error("[whatsapp/qr] erro:", err);
    return NextResponse.json(
      { error: "Falha ao buscar QR Code" },
      { status: 502 },
    );
  }
}
