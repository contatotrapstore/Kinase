import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin, UnauthorizedError } from "@/lib/auth/require-admin";

/**
 * GET /api/questions?pacoteId=xxx
 * Retorna questões de um pacote.
 *
 * Sem auth: omite `is_correct` (gabarito) — proteção pública contra vazamento.
 * Com auth admin: retorna `is_correct` para edição.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pacoteId = searchParams.get("pacoteId");

  if (!pacoteId) {
    return NextResponse.json(
      { error: "pacoteId é obrigatório" },
      { status: 400 }
    );
  }

  // Detectar se chamada vem de admin autenticado
  let isAdmin = false;
  try {
    await requireAdmin();
    isAdmin = true;
  } catch {
    isAdmin = false;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceClient() as any;

    const { data: questoes, error } = await supabase
      .from("questoes")
      .select("id, question_order, text, explanation, explanation_rewritten, image_url, opcoes(id, label, text, is_correct)")
      .eq("pacote_id", pacoteId)
      .order("question_order", { ascending: true });

    if (error) {
      console.error("[api/questions] Erro Supabase:", error);
      return NextResponse.json(
        { error: "Erro ao buscar questões" },
        { status: 500 }
      );
    }

    const questions = (questoes ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (q: any) => ({
        id: q.id,
        order: q.question_order,
        text: q.text,
        options: (q.opcoes ?? [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .sort((a: any, b: any) => a.label.localeCompare(b.label))
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((o: any) => ({
            id: isAdmin ? o.id : undefined,
            label: o.label,
            text: o.text,
            // SÓ inclui is_correct se for chamada autenticada (admin)
            ...(isAdmin ? { isCorrect: o.is_correct } : {}),
          })),
        // Explicação só pra admin (pra evitar vazar resposta)
        ...(isAdmin
          ? { explanation: q.explanation_rewritten ?? q.explanation ?? "" }
          : {}),
        imageUrl: q.image_url ?? null,
        hasImage: Boolean(q.image_url),
      })
    );

    return NextResponse.json({
      questions,
      total: questions.length,
    });
  } catch (err) {
    console.error("[api/questions] Erro interno:", err);
    return NextResponse.json(
      { error: "Erro interno ao buscar questões" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/questions
 * Atualiza uma questão (edição manual pelo admin).
 * Body: { id, text?, explanation?, options?: [{id, text?, isCorrect?}] }
 */
export async function PATCH(request: NextRequest) {
  // PATCH é destrutivo — exige admin autenticado
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }

  try {
    const body = await request.json();
    const { id, text, explanation, options } = body;

    if (!id) {
      return NextResponse.json(
        { error: "id é obrigatório" },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceClient() as any;

    // Atualiza a questão
    const questaoUpdate: Record<string, unknown> = {};
    if (text !== undefined) questaoUpdate.text = text;
    if (explanation !== undefined) questaoUpdate.explanation = explanation;

    if (Object.keys(questaoUpdate).length > 0) {
      const { error: qError } = await supabase
        .from("questoes")
        .update(questaoUpdate)
        .eq("id", id);
      if (qError) {
        console.error("[api/questions] Erro ao atualizar questão:", qError);
        return NextResponse.json(
          { error: "Erro ao atualizar questão" },
          { status: 500 }
        );
      }
    }

    // Atualiza opções se fornecidas
    if (Array.isArray(options)) {
      for (const opt of options) {
        if (!opt.id) continue;
        const optUpdate: Record<string, unknown> = {};
        if (opt.text !== undefined) optUpdate.text = opt.text;
        if (opt.isCorrect !== undefined) optUpdate.is_correct = opt.isCorrect;
        if (Object.keys(optUpdate).length > 0) {
          await supabase.from("opcoes").update(optUpdate).eq("id", opt.id);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao atualizar questão:", error);
    return NextResponse.json(
      { error: "Erro interno ao atualizar questão" },
      { status: 500 }
    );
  }
}
