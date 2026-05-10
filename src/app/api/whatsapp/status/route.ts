import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { requireAdmin, UnauthorizedError } from "@/lib/auth/require-admin";

export const runtime = "nodejs";
export const maxDuration = 10;

/**
 * GET /api/whatsapp/status
 * Consulta a Z-API e retorna o status atual da instância "kinase".
 * Admin only — usado pelo painel pra mostrar badge "Conectado" / "Desconectado".
 *
 * Resposta:
 *   { connected: boolean, name: string, receivedCallbackUrl: string,
 *     paymentStatus: string, error?: string }
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

  try {
    const meRes = await fetch(
      `https://api.z-api.io/instances/${instanceId}/token/${token}/me`,
      { headers: { "Client-Token": clientToken } },
    );

    if (!meRes.ok) {
      return NextResponse.json(
        { error: `Z-API retornou ${meRes.status}` },
        { status: 502 },
      );
    }

    const data = await meRes.json();

    return NextResponse.json({
      connected: Boolean(data.connected),
      name: data.name ?? null,
      paymentStatus: data.paymentStatus ?? null,
      receivedCallbackUrl: data.receivedCallbackUrl ?? null,
      // Se não conectado, indica que precisa re-escanear QR
      needsQrScan: !data.connected,
      qrUrl: !data.connected
        ? `https://app.z-api.io/instances/${instanceId}`
        : null,
    });
  } catch (err) {
    console.error("[whatsapp/status] erro:", err);
    return NextResponse.json(
      { error: "Falha ao consultar Z-API" },
      { status: 502 },
    );
  }
}
