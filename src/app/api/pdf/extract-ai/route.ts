import { NextRequest, NextResponse } from "next/server";
import { extractQuestionsFromImages, PageImage } from "@/lib/ai/pdf-extractor";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/pdf/extract-ai
 * Recebe imagens de páginas de um PDF escaneado e retorna questões extraídas via Claude Vision.
 *
 * Body:
 *   { images: [{ pageNum: number, base64: string, mediaType: string }] }
 *
 * Max: 20 imagens por request (limite Anthropic).
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

    const images = body?.images;
    if (!Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { error: "Campo 'images' deve ser um array não vazio" },
        { status: 400 }
      );
    }
    if (images.length > 20) {
      return NextResponse.json(
        { error: "Máximo de 20 imagens por request" },
        { status: 400 }
      );
    }

    const pageImages: PageImage[] = [];
    for (const img of images) {
      if (
        typeof img?.pageNum !== "number" ||
        typeof img?.base64 !== "string" ||
        !img.base64
      ) {
        return NextResponse.json(
          { error: "Cada imagem precisa de pageNum (number) e base64 (string)" },
          { status: 400 }
        );
      }

      const mediaType =
        img.mediaType === "image/png" || img.mediaType === "image/webp"
          ? img.mediaType
          : "image/jpeg";

      // Strip data URL prefix se vier com
      const base64 = img.base64.startsWith("data:")
        ? img.base64.split(",")[1] ?? ""
        : img.base64;

      pageImages.push({ pageNum: img.pageNum, base64, mediaType });
    }

    const questions = await extractQuestionsFromImages(pageImages);

    return NextResponse.json({
      success: true,
      count: questions.length,
      questions,
    });
  } catch (error) {
    console.error("Erro em /api/pdf/extract-ai:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
