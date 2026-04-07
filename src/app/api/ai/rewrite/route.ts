import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rewriteExplanation } from "@/lib/ai/rewriter";

/**
 * POST /api/ai/rewrite
 * Reescreve uma explicação usando IA.
 *
 * Body:
 *   { questionId: string }  — busca do banco, reescreve e salva
 *   { text: string }        — modo preview, apenas retorna o texto reescrito
 */
export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "JSON inválido no corpo da requisição" },
        { status: 400 }
      );
    }

    const { questionId, text } = body;

    // Preview mode: rewrite arbitrary text without saving
    if (text && typeof text === "string") {
      const rewritten = await rewriteExplanation(text);
      return NextResponse.json({ success: true, rewritten });
    }

    // Database mode: fetch, rewrite, and save
    if (questionId && typeof questionId === "string") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = (await createClient()) as any;

      const { data: questao, error: fetchError } = await supabase
        .from("questoes")
        .select("id, explanation")
        .eq("id", questionId)
        .single();

      if (fetchError || !questao) {
        return NextResponse.json(
          { error: "Questão não encontrada" },
          { status: 404 }
        );
      }

      if (!questao.explanation) {
        return NextResponse.json(
          { error: "Questão não possui explicação para reescrever" },
          { status: 400 }
        );
      }

      const rewritten = await rewriteExplanation(questao.explanation);

      if (rewritten !== questao.explanation) {
        const { error: updateError } = await supabase
          .from("questoes")
          .update({ explanation_rewritten: rewritten })
          .eq("id", questao.id);

        if (updateError) {
          console.error("Erro ao salvar explicação reescrita:", updateError);
          return NextResponse.json(
            { error: "Erro ao salvar explicação reescrita" },
            { status: 500 }
          );
        }
      }

      return NextResponse.json({
        success: true,
        questionId: questao.id,
        rewritten,
      });
    }

    return NextResponse.json(
      { error: "Envie 'questionId' ou 'text' no corpo da requisição" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Erro na rota /api/ai/rewrite:", error);
    return NextResponse.json(
      { error: "Erro interno ao reescrever explicação" },
      { status: 500 }
    );
  }
}
