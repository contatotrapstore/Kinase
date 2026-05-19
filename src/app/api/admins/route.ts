import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { requireAdmin, UnauthorizedError } from "@/lib/auth/require-admin";

export const runtime = "nodejs";

function adminClient() {
  return createServiceClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/**
 * GET /api/admins — lista todos os administradores cadastrados no painel.
 * POST /api/admins — cria novo administrador (body: { email, password, name? }).
 * Ambos exigem sessão admin ativa.
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

  const supabase = adminClient();
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 100 });
  if (error) {
    console.error("[admins:GET] erro listando users:", error);
    return NextResponse.json({ error: "Falha ao listar administradores" }, { status: 500 });
  }

  const admins = (data?.users ?? []).map((u) => ({
    id: u.id,
    email: u.email,
    name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? null,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
  }));

  return NextResponse.json({ admins });
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }

  let body: { email?: string; password?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const { email, password, name } = body;
  if (!email || !password) {
    return NextResponse.json({ error: "email e password são obrigatórios" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Senha precisa ter pelo menos 6 caracteres" }, { status: 400 });
  }

  const supabase = adminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: name ? { full_name: name } : undefined,
  });

  if (error) {
    console.error("[admins:POST] erro criando user:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    admin: {
      id: data.user?.id,
      email: data.user?.email,
      name: data.user?.user_metadata?.full_name ?? null,
      created_at: data.user?.created_at,
    },
  });
}
