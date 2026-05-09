import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { parsePdfText } from "@/lib/pdf/parser";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/pacotes/[id]/gabarito
 * Recebe um PDF de Gabarito comentado (formato Estratégia Med ou similar)
 * e atualiza as opcoes do pacote marcando as respostas corretas + explicações.
 *
 * Body: multipart/form-data com `file` (PDF)
 *
 * Retorna: { matched: N, updated: N, skipped: N }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: pacoteId } = await params;
    if (!pacoteId) {
      return NextResponse.json(
        { error: "pacoteId é obrigatório" },
        { status: 400 },
      );
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "FormData inválido" },
        { status: 400 },
      );
    }

    const file = formData.get("file") as File | null;
    if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Envie um PDF (.pdf) no campo 'file'" },
        { status: 400 },
      );
    }

    // 1. Extrair texto do PDF
    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    let pdfText: string;
    try {
      const { PDFParse } = await import("pdf-parse");
      const pdfParser = new PDFParse({ data: uint8 });
      const textResult = await pdfParser.getText();
      pdfText = textResult.text;
      await pdfParser.destroy();
    } catch (err) {
      console.error("Erro ao extrair PDF:", err);
      return NextResponse.json(
        { error: "Não foi possível ler o PDF" },
        { status: 422 },
      );
    }

    if (!pdfText || pdfText.trim().length < 50) {
      return NextResponse.json(
        {
          error:
            "PDF parece ser escaneado ou vazio — gabarito precisa ter texto extraível",
        },
        { status: 422 },
      );
    }

    // 2. Parser — usa parseGabaritoComentado dentro do parsePdfText
    const parsed = parsePdfText(pdfText);
    if (parsed.length === 0) {
      return NextResponse.json(
        {
          error:
            "Não foi possível identificar questões no gabarito. Confirma que é o PDF certo (formato 'N - YYYY BANCA' / 'Resposta: letra X')",
        },
        { status: 422 },
      );
    }

    // 3. Buscar questões do pacote-alvo
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceClient() as any;

    const { data: questoes, error: qError } = await supabase
      .from("questoes")
      .select("id, question_order, opcoes(id, label, is_correct)")
      .eq("pacote_id", pacoteId);

    if (qError || !questoes) {
      console.error("Erro ao buscar questões do pacote:", qError);
      return NextResponse.json(
        { error: "Pacote não encontrado ou sem questões" },
        { status: 404 },
      );
    }

    // 4. Para cada questão parseada do gabarito, fazer match por question_order
    // e atualizar a opção correta + explicação
    let matched = 0;
    let updated = 0;
    let skipped = 0;

    for (const parsedQ of parsed) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const questao = (questoes as any[]).find(
        (q) => q.question_order === parsedQ.order,
      );
      if (!questao) {
        skipped++;
        continue;
      }
      matched++;

      // Encontrar qual opção foi marcada como correta no gabarito parseado
      const correctOpt = parsedQ.options.find((o) => o.isCorrect);
      if (!correctOpt) {
        // Sem gabarito identificado para essa questão — pula
        continue;
      }

      // Encontrar a opção correspondente na questão do banco (mesmo label)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const targetOpt = (questao.opcoes as any[]).find(
        (o) => o.label === correctOpt.label,
      );
      if (!targetOpt) continue;

      // Atualizar: marcar correta E desmarcar as outras da mesma questão
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const otherIds = (questao.opcoes as any[])
        .filter((o) => o.id !== targetOpt.id)
        .map((o) => o.id);

      if (otherIds.length > 0) {
        await supabase
          .from("opcoes")
          .update({ is_correct: false })
          .in("id", otherIds);
      }

      await supabase
        .from("opcoes")
        .update({ is_correct: true })
        .eq("id", targetOpt.id);

      // Atualizar explicação se houver
      if (parsedQ.explanation && parsedQ.explanation.length > 10) {
        await supabase
          .from("questoes")
          .update({ explanation: parsedQ.explanation })
          .eq("id", questao.id);
      }

      updated++;
    }

    return NextResponse.json({
      success: true,
      filename: file.name,
      parsed: parsed.length,
      matched,
      updated,
      skipped,
    });
  } catch (err) {
    console.error("Erro ao importar gabarito:", err);
    return NextResponse.json(
      { error: "Erro interno ao processar gabarito" },
      { status: 500 },
    );
  }
}
