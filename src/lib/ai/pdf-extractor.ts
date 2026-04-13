import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

export interface ExtractedOption {
  label: "A" | "B" | "C" | "D";
  text: string;
  isCorrect: boolean;
}

export interface ExtractedQuestion {
  order: number;
  text: string;
  options: ExtractedOption[];
  explanation?: string;
  hasImage: boolean;
}

export interface PageImage {
  pageNum: number;
  /** Base64 data sem o prefixo `data:image/jpeg;base64,` */
  base64: string;
  /** Mime type, ex: "image/jpeg" */
  mediaType: "image/jpeg" | "image/png" | "image/webp";
}

const EXTRACTION_PROMPT = `Você é um extrator especialista de questões médicas em PDFs. As imagens anexadas são páginas de uma apostila médica em português brasileiro contendo questões de múltipla escolha (A, B, C, D).

Extraia TODAS as questões completas das imagens e retorne APENAS um JSON válido no formato:

{
  "questions": [
    {
      "order": 1,
      "text": "enunciado completo da questão",
      "options": [
        { "label": "A", "text": "texto da opção A", "isCorrect": false },
        { "label": "B", "text": "texto da opção B", "isCorrect": true },
        { "label": "C", "text": "texto da opção C", "isCorrect": false },
        { "label": "D", "text": "texto da opção D", "isCorrect": false }
      ],
      "explanation": "comentário/explicação da questão, se presente"
    }
  ]
}

REGRAS:
- Ignore capas, índices, páginas em branco, sumários
- Se a questão estiver dividida entre páginas, combine em uma única questão
- Marque EXATAMENTE UMA opção como isCorrect=true (use o gabarito visível)
- Se não houver gabarito visível, marque todas como false
- NÃO invente questões que não estão visíveis nas imagens
- Enumere sequencialmente dentro do batch (1, 2, 3...)
- Inclua a explicação completa quando houver comentário/resolução
- Retorne APENAS o JSON, sem markdown, sem texto adicional, sem \`\`\`json\`\`\``;

/**
 * Extrai questões de um batch de imagens de páginas de PDF usando Claude Vision.
 * Cada chamada aceita até ~20 imagens (limite do Anthropic).
 */
export async function extractQuestionsFromImages(
  images: PageImage[],
): Promise<ExtractedQuestion[]> {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY não configurada");
  }
  if (images.length === 0) return [];
  if (images.length > 20) {
    throw new Error(`Máximo de 20 imagens por request (recebido ${images.length})`);
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const imageBlocks = images.map((img) => ({
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: img.mediaType,
      data: img.base64,
    },
  }));

  const message = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: [
          ...imageBlocks,
          { type: "text", text: EXTRACTION_PROMPT },
        ],
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude não retornou conteúdo de texto");
  }

  const raw = textBlock.text.trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Resposta do Claude não contém JSON válido");
  }

  let parsed: { questions?: unknown };
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err) {
    throw new Error(`JSON inválido: ${err instanceof Error ? err.message : "parse error"}`);
  }

  if (!Array.isArray(parsed.questions)) {
    return [];
  }

  const validated: ExtractedQuestion[] = [];
  for (const q of parsed.questions as Array<Record<string, unknown>>) {
    if (typeof q.text !== "string" || !Array.isArray(q.options)) continue;

    const options: ExtractedOption[] = [];
    for (const opt of q.options as Array<Record<string, unknown>>) {
      if (typeof opt.label !== "string" || typeof opt.text !== "string") continue;
      const label = opt.label.toUpperCase();
      if (label !== "A" && label !== "B" && label !== "C" && label !== "D") continue;
      options.push({
        label: label as "A" | "B" | "C" | "D",
        text: opt.text.trim(),
        isCorrect: Boolean(opt.isCorrect),
      });
    }

    if (options.length === 0) continue;

    validated.push({
      order: typeof q.order === "number" ? q.order : validated.length + 1,
      text: q.text.trim(),
      options,
      explanation: typeof q.explanation === "string" ? q.explanation.trim() : undefined,
      hasImage: false,
    });
  }

  return validated;
}
