import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/pacotes
 * Cria um novo pacote com questões e opções a partir do resultado do parse.
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

    const { name, subject, questions } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Campo 'name' é obrigatório" },
        { status: 400 }
      );
    }

    if (!subject || typeof subject !== "string") {
      return NextResponse.json(
        { error: "Campo 'subject' é obrigatório" },
        { status: 400 }
      );
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { error: "É necessário pelo menos uma questão" },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = await createClient() as any;

    // 1. Buscar ou criar a área de conhecimento
    let areaId: string;

    const { data: existingArea } = await supabase
      .from("areas_conhecimento")
      .select("id")
      .eq("name", subject)
      .single();

    if (existingArea) {
      areaId = existingArea.id;
    } else {
      const { data: newArea, error: areaError } = await supabase
        .from("areas_conhecimento")
        .insert({ name: subject })
        .select("id")
        .single();

      if (areaError || !newArea) {
        console.error("Erro ao criar área:", areaError);
        return NextResponse.json(
          { error: "Erro ao criar área de conhecimento" },
          { status: 500 }
        );
      }
      areaId = newArea.id;
    }

    // 2. Determinar tamanho do pacote (10, 20 ou 30)
    const count = questions.length;
    const tamanho: 10 | 20 | 30 = count <= 10 ? 10 : count <= 20 ? 20 : 30;

    // 3. Criar o pacote
    const { data: pacote, error: pacoteError } = await supabase
      .from("pacotes")
      .insert({
        name,
        area_id: areaId,
        tamanho,
        status: "ready" as const,
        total_questions: count,
      })
      .select("id")
      .single();

    if (pacoteError || !pacote) {
      console.error("Erro ao criar pacote:", pacoteError);
      return NextResponse.json(
        { error: "Erro ao criar pacote" },
        { status: 500 }
      );
    }

    // 4. Inserir questões
    const questoesInsert = questions.map(
      (q: { order: number; text: string; explanation?: string }, i: number) => ({
        pacote_id: pacote.id,
        question_order: q.order ?? i + 1,
        text: q.text,
        explanation: q.explanation ?? null,
      })
    );

    const { data: questoesData, error: questoesError } = await supabase
      .from("questoes")
      .insert(questoesInsert)
      .select("id, question_order");

    if (questoesError || !questoesData) {
      console.error("Erro ao inserir questões:", questoesError);
      return NextResponse.json(
        { error: "Erro ao inserir questões" },
        { status: 500 }
      );
    }

    // 5. Inserir opções de cada questão
    const opcoesInsert: {
      questao_id: string;
      label: "A" | "B" | "C" | "D";
      text: string;
      is_correct: boolean;
    }[] = [];

    for (const q of questions) {
      const questaoRow = questoesData.find(
        (qd: any) => qd.question_order === (q.order ?? 0)
      );
      if (!questaoRow) continue;

      for (const opt of q.options ?? []) {
        if (["A", "B", "C", "D"].includes(opt.label)) {
          opcoesInsert.push({
            questao_id: questaoRow.id,
            label: opt.label as "A" | "B" | "C" | "D",
            text: opt.text,
            is_correct: opt.isCorrect ?? false,
          });
        }
      }
    }

    if (opcoesInsert.length > 0) {
      const { error: opcoesError } = await supabase
        .from("opcoes")
        .insert(opcoesInsert);

      if (opcoesError) {
        console.error("Erro ao inserir opções:", opcoesError);
        // Pacote e questões já foram criados, não é fatal
      }
    }

    return NextResponse.json({
      success: true,
      pacoteId: pacote.id,
      totalQuestions: questoesData.length,
    });
  } catch (error) {
    console.error("Erro ao criar pacote:", error);
    return NextResponse.json(
      { error: "Erro interno ao criar pacote" },
      { status: 500 }
    );
  }
}
