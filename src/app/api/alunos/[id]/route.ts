import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin, UnauthorizedError } from "@/lib/auth/require-admin";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });
  }

  let body: { grupo?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const raw = body.grupo;
  if (raw !== null && typeof raw !== "string") {
    return NextResponse.json(
      { error: "Campo 'grupo' deve ser string ou null" },
      { status: 400 },
    );
  }

  const grupo =
    raw === null || (typeof raw === "string" && raw.trim() === "")
      ? null
      : raw.trim();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any;

  const { data, error } = await supabase
    .from("usuarios")
    .update({ grupo_experimental: grupo })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("[alunos:PATCH] erro ao atualizar usuário:", error);
    return NextResponse.json(
      { error: "Falha ao atualizar usuário" },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Usuário não encontrado" },
      { status: 404 },
    );
  }

  return NextResponse.json({ usuario: data });
}
