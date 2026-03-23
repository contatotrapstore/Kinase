// Stub para extração de imagens de PDFs
// Será implementado quando os PDFs reais do cliente estiverem disponíveis

interface ExtractedImage {
  pageNumber: number;
  imageBuffer: Buffer;
  mimeType: string;
}

/**
 * Extrai imagens de um PDF.
 *
 * TODO: Implementar extração real usando pdf-img-convert ou pdfjs-dist
 * quando os PDFs do cliente estiverem disponíveis para testar.
 * Dependência sugerida: pdf-img-convert (npm install pdf-img-convert)
 *
 * Passos para implementação futura:
 * 1. Usar pdf-img-convert para converter páginas em imagens
 * 2. Detectar quais páginas contêm figuras relevantes (vs. apenas texto)
 * 3. Recortar área da imagem se necessário
 * 4. Retornar buffer com mime type correto
 */
export async function extractImagesFromPdf(
  _pdfBuffer: Buffer
): Promise<ExtractedImage[]> {
  // TODO: implementar quando PDFs reais do cliente chegarem
  return [];
}
