import { NextRequest, NextResponse } from "next/server";
import { parsePdfText } from "@/lib/pdf/parser";

/**
 * POST /api/pdf/parse
 * Recebe texto bruto de um PDF e retorna questões estruturadas.
 */
export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'JSON inválido no corpo da requisição' }, { status: 400 });
    }
    const { text } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Campo 'text' (string) é obrigatório" },
        { status: 400 }
      );
    }

    if (text.trim().length === 0) {
      return NextResponse.json(
        { error: "O texto enviado está vazio" },
        { status: 400 }
      );
    }

    const questions = parsePdfText(text);

    // Coleta áreas únicas (por enquanto baseado em keywords simples)
    const areaKeywords: Record<string, string[]> = {
      Cardiologia: ["coração", "cardíac", "miocárdio", "arritmia", "infarto", "ECG", "eletrocardiograma"],
      Pneumologia: ["pulmão", "pulmonar", "brônquio", "asma", "DPOC", "pneumonia", "respiratór"],
      Neurologia: ["cérebro", "cerebral", "neurônio", "AVC", "epilepsia", "meningite", "nervo"],
      Gastroenterologia: ["estômago", "intestino", "fígado", "hepát", "gastrite", "úlcera", "esôfago"],
      Endocrinologia: ["diabetes", "tireoide", "hormônio", "insulina", "hipófise", "adrenal"],
      Nefrologia: ["rim", "renal", "nefr", "diálise", "glomérul", "urina"],
      Infectologia: ["infecção", "bactéria", "vírus", "antibiótico", "febre", "sepse"],
      Ortopedia: ["osso", "fratura", "articulação", "coluna", "ortopéd"],
      Pediatria: ["criança", "pediátr", "neonatal", "recém-nascido", "lactente"],
      "Clínica Médica": [], // fallback
    };

    const detectedAreas = new Set<string>();
    for (const q of questions) {
      const fullText = (q.text + " " + q.options.map((o) => o.text).join(" ")).toLowerCase();
      let matched = false;
      for (const [area, keywords] of Object.entries(areaKeywords)) {
        if (area === "Clínica Médica") continue;
        if (keywords.some((kw) => fullText.includes(kw.toLowerCase()))) {
          detectedAreas.add(area);
          matched = true;
          break;
        }
      }
      if (!matched) {
        detectedAreas.add("Clínica Médica");
      }
    }

    return NextResponse.json({
      questions,
      count: questions.length,
      areas: Array.from(detectedAreas),
    });
  } catch (error) {
    console.error("Erro ao parsear texto do PDF:", error);
    return NextResponse.json(
      { error: "Erro interno ao processar texto do PDF" },
      { status: 500 }
    );
  }
}
