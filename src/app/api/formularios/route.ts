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

/**
 * GET /api/formularios
 * Lista todos formularios ordenados por tipo, depois nome.
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

  const supabase = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("formularios")
    .select("*")
    .order("tipo", { ascending: true })
    .order("nome", { ascending: true });

  if (error) {
    console.error("[formularios:GET] erro:", error);
    return NextResponse.json(
      { error: "Falha ao listar formularios" },
      { status: 500 }
    );
  }

  return NextResponse.json({ formularios: data ?? [] });
}

/**
 * POST /api/formularios
 * Cria novo formulario.
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

  let body: {
    tipo?: Tipo;
    nome?: string;
    perguntas?: unknown;
    ativo?: boolean;
    trigger_apos_dias?: number;
    trigger_apos_questoes?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalido" }, { status: 400 });
  }

  const { tipo, nome, perguntas, ativo, trigger_apos_dias, trigger_apos_questoes } =
    body;

  if (tipo !== "pre" && tipo !== "pos") {
    return NextResponse.json(
      { error: "tipo deve ser 'pre' ou 'pos'" },
      { status: 400 }
    );
  }
  if (!nome || typeof nome !== "string" || !nome.trim()) {
    return NextResponse.json({ error: "nome obrigatorio" }, { status: 400 });
  }

  const perguntasValid = validatePerguntas(perguntas);
  if (perguntasValid === null) {
    return NextResponse.json(
      { error: "perguntas invalidas" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("formularios")
    .insert({
      tipo,
      nome: nome.trim(),
      perguntas: perguntasValid,
      ativo: ativo ?? true,
      trigger_apos_dias:
        tipo === "pos" && typeof trigger_apos_dias === "number"
          ? trigger_apos_dias
          : null,
      trigger_apos_questoes:
        tipo === "pos" && typeof trigger_apos_questoes === "number"
          ? trigger_apos_questoes
          : null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[formularios:POST] erro:", error);
    return NextResponse.json(
      { error: "Falha ao criar formulario" },
      { status: 500 }
    );
  }

  return NextResponse.json({ formulario: data });
}
