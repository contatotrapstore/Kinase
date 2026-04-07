import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

const SYSTEM_PROMPT = `Você é um especialista em educação médica. Reescreva a explicação da questão de prova médica abaixo em português brasileiro claro e didático.

Regras:
- Torne o texto original e único (anti-plágio)
- Foque em ensinar o conceito central
- Mantenha conciso (máximo 3 parágrafos)
- Não adicione informações que não estejam no texto original
- Use linguagem acessível mas tecnicamente precisa
- Não use formatação markdown, apenas texto corrido`;

export async function rewriteExplanation(originalText: string): Promise<string> {
  if (!env.ANTHROPIC_API_KEY || !originalText?.trim()) {
    return originalText ?? "";
  }

  try {
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: originalText }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    return textBlock?.text ?? originalText;
  } catch (error) {
    console.error("Erro ao reescrever explicação:", error);
    return originalText; // fallback to original
  }
}
