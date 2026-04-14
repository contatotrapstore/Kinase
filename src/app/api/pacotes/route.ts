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

    const { name, subject, questions, images, isFirstBatch, pacoteId: existingPacoteId } = body;
    const imageList: { page: number; dataUrl: string }[] = Array.isArray(images) ? images : [];

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

    // 2. Criar pacote (primeiro lote) ou usar existente (lotes seguintes)
    let pacoteIdToUse: string;

    if (isFirstBatch !== false && !existingPacoteId) {
      // Primeiro lote — criar pacote novo
      const count = questions.length;
      const tamanho: 10 | 20 | 30 = count <= 10 ? 10 : count <= 20 ? 20 : 30;

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
      pacoteIdToUse = pacote.id;
    } else {
      // Lotes seguintes — usar pacote existente
      pacoteIdToUse = existingPacoteId;

      // Atualizar total_questions do pacote — SOMA cumulativa
      const { data: current } = await supabase
        .from("pacotes")
        .select("total_questions")
        .eq("id", pacoteIdToUse)
        .single();
      const newTotal = (current?.total_questions ?? 0) + questions.length;
      await supabase
        .from("pacotes")
        .update({ total_questions: newTotal })
        .eq("id", pacoteIdToUse);
    }

    // 4. Inserir questões
    const questoesInsert = questions.map(
      (q: { order: number; text: string; explanation?: string }, i: number) => ({
        pacote_id: pacoteIdToUse,
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

    // 6. Upload images for questions that have hasImage=true
    if (imageList.length > 0) {
      // Build a map of question order -> hasImage from the request
      const questionsWithImage = questions
        .filter((q: { hasImage?: boolean }) => q.hasImage)
        .map((q: { order: number }, idx: number) => ({
          order: q.order ?? idx + 1,
        }));

      for (let imgIdx = 0; imgIdx < Math.min(questionsWithImage.length, imageList.length); imgIdx++) {
        const qOrder = questionsWithImage[imgIdx].order;
        const image = imageList[imgIdx];

        // Find the inserted question row by order
        const questaoRow = questoesData.find(
          (qd: any) => qd.question_order === qOrder
        );
        if (!questaoRow || !image.dataUrl) continue;

        try {
          // Convert dataUrl to buffer
          const base64Data = image.dataUrl.split(",")[1];
          const buffer = Buffer.from(base64Data, "base64");
          const mimeType = image.dataUrl.split(";")[0].split(":")[1] || "image/png";
          const ext = mimeType.split("/")[1] || "png";

          const filePath = `question-images/${pacoteIdToUse}/${qOrder}.${ext}`;
          await supabase.storage
            .from("question-images")
            .upload(filePath, buffer, { contentType: mimeType, upsert: true });

          const { data: urlData } = supabase.storage
            .from("question-images")
            .getPublicUrl(filePath);

          if (urlData?.publicUrl) {
            await supabase
              .from("questoes")
              .update({ image_url: urlData.publicUrl })
              .eq("id", questaoRow.id);
          }
        } catch (imgErr) {
          console.error(`Erro ao fazer upload da imagem para questão ${qOrder}:`, imgErr);
          // Non-fatal: continue with other images
        }
      }
    }

    // Reescrita IA desativada a pedido do cliente.
    // A função rewriteExplanationsForPacote continua abaixo para futura reativação.

    return NextResponse.json({
      success: true,
      pacoteId: pacoteIdToUse,
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

/**
 * Reescreve as explicações de todas as questões de um pacote usando IA.
 * Processamento sequencial para evitar rate limits da API.
 */
async function rewriteExplanationsForPacote(pacoteId: string) {
  const { rewriteExplanation } = await import("@/lib/ai/rewriter");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  const { data: questoes } = await supabase
    .from("questoes")
    .select("id, explanation")
    .eq("pacote_id", pacoteId)
    .not("explanation", "is", null);

  if (!questoes) return;

  // Process sequentially to avoid rate limits
  for (const q of questoes) {
    if (!q.explanation) continue;
    const rewritten = await rewriteExplanation(q.explanation);
    if (rewritten !== q.explanation) {
      await supabase
        .from("questoes")
        .update({ explanation_rewritten: rewritten })
        .eq("id", q.id);
    }
  }
}
