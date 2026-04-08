import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

/**
 * POST /api/pdf/upload
 * Recebe um PDF via multipart/form-data, extrai texto com pdf-parse.
 * Se texto extraído for insignificante (PDF escaneado), retorna flag needsOCR.
 * Retorna id, filename, texto extraído, número de páginas e flag needsOCR.
 */
export async function POST(request: NextRequest) {
  try {
    let formData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "FormData inválido na requisição" },
        { status: 400 }
      );
    }
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Nenhum arquivo enviado" },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Apenas arquivos PDF são aceitos" },
        { status: 400 }
      );
    }

    // Limite de 50MB (PDFs escaneados podem ser grandes)
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Arquivo muito grande. Máximo permitido: 50MB" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    // Validar magic bytes do PDF (%PDF-)
    if (
      uint8.length < 5 ||
      uint8[0] !== 0x25 ||
      uint8[1] !== 0x50 ||
      uint8[2] !== 0x44 ||
      uint8[3] !== 0x46 ||
      uint8[4] !== 0x2d
    ) {
      return NextResponse.json(
        { error: "O arquivo não é um PDF válido." },
        { status: 400 }
      );
    }

    let text: string;
    let pageCount: number;

    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: uint8 });
      const textResult = await parser.getText();
      text = textResult.text;
      pageCount = textResult.total;
      await parser.destroy();
    } catch (parseError) {
      console.error("Erro ao extrair texto do PDF:", parseError);
      return NextResponse.json(
        { error: "Não foi possível extrair texto do PDF." },
        { status: 422 }
      );
    }

    // Verificar se o texto é significativo (não apenas marcadores de página)
    const meaningfulText = text
      .replace(/--\s*\d+\s*of\s*\d+\s*--/g, "")
      .replace(/\s+/g, "")
      .trim();

    const needsOCR = meaningfulText.length < 100;

    return NextResponse.json({
      id: uuidv4(),
      filename: file.name,
      text: needsOCR ? "" : text,
      pageCount,
      needsOCR,
    });
  } catch (error) {
    console.error("Erro no upload do PDF:", error);
    return NextResponse.json(
      { error: "Erro interno ao processar upload" },
      { status: 500 }
    );
  }
}
