import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, UnauthorizedError } from "@/lib/auth/require-admin";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

type Escala = "1-5" | "sim_nao" | "texto";
type Tipo = "pre" | "pos";

interface Pergunta {
  id: string;
  texto: string;
  escala: Escala;
}

function isValidEscala(v: unknown): v is Escala {
  return v === "1-5" || v === "sim_nao" || v === "texto";
}

function validatePerguntas(input: unknown): Pergunta[] | null {
  if (!Array.isArray(input)) return null;
  const out: Pergunta[] = [];
  for (const p of input) {
    if (
      !p ||
      typeof p !== "object" ||
      typeof (p as any).id !== "string" ||
      typeof (p as any).texto !== "string" ||
      !isValidEscala((p as any).escala)
    ) {
      return null;
    }
    out.push({
      id: (p as any).id,
      texto: (p as any).texto,
      escala: (p as any).escala,
    });
  }
  return out;
}

async function authOrError() {
  try {
    await requireAdmin();
    return null;
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }
}

/**
 * GET /api/formularios/[id]
 * Retorna formulario + contagem de respostas concluidas.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await authOrError();
  if (authErr) return authErr;

  const { id } = await params;
  const supabase = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: formulario, error } = await (supabase as any)
    .from("formularios")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !formulario) {
    return NextResponse.json(
      { error: "Formulario nao encontrado" },
      { status: 404 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (supabase as any)
    .from("formularios_respostas")
    .select("id", { count: "exact", head: true })
    .eq("formulario_id", id)
    .not("concluido_at", "is", null);

  return NextResponse.json({
    formulario,
    respostas_count: count ?? 0,
  });
}

/**
 * PATCH /api/formularios/[id]
 * Atualiza qualquer campo do formulario.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await authOrError();
  if (authErr) return authErr;

  const { id } = await params;

  let body: {
    tipo?: Tipo;
    nome?: string;
    perguntas?: unknown;
    ativo?: boolean;
    trigger_apos_dias?: number | null;
    trigger_apos_questoes?: number | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalido" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};

  if (body.tipo !== undefined) {
    if (body.tipo !== "pre" && body.tipo !== "pos") {
      return NextResponse.json({ error: "tipo invalido" }, { status: 400 });
    }
    update.tipo = body.tipo;
  }
  if (body.nome !== undefined) {
    if (typeof body.nome !== "string" || !body.nome.trim()) {
      return NextResponse.json({ error: "nome invalido" }, { status: 400 });
    }
    update.nome = body.nome.trim();
  }
  if (body.perguntas !== undefined) {
    const validated = validatePerguntas(body.perguntas);
    if (validated === null) {
      return NextResponse.json(
        { error: "perguntas invalidas" },
        { status: 400 }
      );
    }
    update.perguntas = validated;
  }
  if (body.ativo !== undefined) {
    update.ativo = !!body.ativo;
  }
  if (body.trigger_apos_dias !== undefined) {
    update.trigger_apos_dias = body.trigger_apos_dias;
  }
  if (body.trigger_apos_questoes !== undefined) {
    update.trigger_apos_questoes = body.trigger_apos_questoes;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "Nenhum campo para atualizar" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("formularios")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("[formularios:PATCH] erro:", error);
    return NextResponse.json(
      { error: "Falha ao atualizar formulario" },
      { status: 500 }
    );
  }

  return NextResponse.json({ formulario: data });
}

/**
 * DELETE /api/formularios/[id]
 * Deleta formulario (cascade nas respostas).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await authOrError();
  if (authErr) return authErr;

  const { id } = await params;
  const supabase = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("formularios")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[formularios:DELETE] erro:", error);
    return NextResponse.json(
      { error: "Falha ao deletar formulario" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
