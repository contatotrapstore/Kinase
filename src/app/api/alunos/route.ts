import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin, UnauthorizedError } from "@/lib/auth/require-admin";

export const runtime = "nodejs";

/**
 * Normaliza um telefone brasileiro pro formato E.164 puro (só dígitos, com 55).
 * Aceita "(27) 99613-2820", "+55 27 99613-2820", "27996132820", "5527996132820"...
 * Retorna null se inválido (não bate com celular BR).
 */
function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;
  // Se já vem com 55 na frente e tem tamanho válido (12 ou 13 = ddd + 8/9 dígitos)
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }
  // Sem 55 na frente, com ddd (10 = fixo, 11 = celular)
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return null;
}

/**
 * POST /api/alunos
 * Cria usuário manualmente pelo painel admin — pra pré-cadastrar participantes
 * do experimento antes de eles mandarem o 1º /start.
 * Body: { phone: string; name?: string; grupo_experimental?: string }
 * Auth: admin.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }

  let body: { phone?: string; name?: string; grupo_experimental?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  if (!body.phone || typeof body.phone !== "string") {
    return NextResponse.json({ error: "Campo 'phone' obrigatório" }, { status: 400 });
  }

  const phone = normalizePhone(body.phone);
  if (!phone) {
    return NextResponse.json(
      { error: "Telefone inválido — use formato (DDD) 9XXXX-XXXX ou +55 DDD..." },
      { status: 400 },
    );
  }

  const name =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim()
      : phone.slice(-4);
  const grupo =
    typeof body.grupo_experimental === "string" && body.grupo_experimental.trim()
      ? body.grupo_experimental.trim()
      : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any;

  // Verifica duplicidade
  const { data: existing } = await supabase
    .from("usuarios")
    .select("id, phone, name, grupo_experimental")
    .eq("phone", phone)
    .maybeSingle();

  if (existing) {
    // Já existe — atualiza grupo/name se veio, retorna 200 idempotente
    const patch: Record<string, unknown> = {};
    if (body.name && body.name.trim()) patch.name = name;
    if (grupo !== undefined && grupo !== existing.grupo_experimental) {
      patch.grupo_experimental = grupo;
    }
    if (Object.keys(patch).length > 0) {
      await supabase.from("usuarios").update(patch).eq("id", existing.id);
    }
    return NextResponse.json({
      usuario: { ...existing, ...patch },
      created: false,
      message: "Usuário já existia — atualizado.",
    });
  }

  const { data, error } = await supabase
    .from("usuarios")
    .insert({ phone, name, grupo_experimental: grupo })
    .select("*")
    .single();

  if (error) {
    console.error("[alunos:POST] erro ao criar usuário:", error);
    return NextResponse.json(
      { error: "Falha ao criar usuário" },
      { status: 500 },
    );
  }

  return NextResponse.json({ usuario: data, created: true });
}
