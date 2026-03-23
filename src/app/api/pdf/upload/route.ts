import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { PDFParse } from "pdf-parse";

/**
 * POST /api/pdf/upload
 * Recebe um PDF via multipart/form-data, extrai texto com pdf-parse.
 * Retorna id, filename, texto extraído e número de páginas.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
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

    // Limite de 10MB
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Arquivo muito grande. Máximo permitido: 10MB" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    let text: string;
    let pageCount: number;

    try {
      const parser = new PDFParse({ data: uint8 });
      const textResult = await parser.getText();
      text = textResult.text;
      pageCount = textResult.total;
      await parser.destroy();
    } catch (parseError) {
      console.error("Erro ao extrair texto do PDF:", parseError);
      return NextResponse.json(
        { error: "Não foi possível extrair texto do PDF. Verifique se o arquivo é um PDF válido." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      id: uuidv4(),
      filename: file.name,
      text,
      pageCount,
    });
  } catch (error) {
    console.error("Erro no upload do PDF:", error);
    return NextResponse.json(
      { error: "Erro interno ao processar upload" },
      { status: 500 }
    );
  }
}
