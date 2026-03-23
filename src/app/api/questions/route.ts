import { NextRequest, NextResponse } from "next/server";

const mockQuestions = [
  {
    id: "q1",
    order: 1,
    text: "Paciente de 62 anos, hipertenso, chega ao pronto-socorro com dor torácica retroesternal há 2 horas, irradiando para membro superior esquerdo. ECG mostra supradesnivelamento de ST em DII, DIII e aVF. Qual é a conduta inicial mais adequada?",
    options: [
      { label: "A", text: "Administrar AAS 300mg, clopidogrel 300mg e encaminhar para cateterismo de emergência", isCorrect: true },
      { label: "B", text: "Solicitar troponina seriada e manter em observação por 12 horas", isCorrect: false },
      { label: "C", text: "Prescrever anti-inflamatório e analgésico para controle da dor", isCorrect: false },
      { label: "D", text: "Realizar ecocardiograma transtorácico antes de qualquer intervenção", isCorrect: false },
    ],
    explanation: "O quadro é compatível com IAM com supra de ST em parede inferior. A conduta envolve dupla antiagregação e reperfusão imediata (angioplastia primária).",
    area: "Cardiologia",
    hasImage: false,
  },
  {
    id: "q2",
    order: 2,
    text: "Criança de 4 anos apresenta febre há 5 dias, conjuntivite bilateral não exsudativa, eritema e edema de mãos e pés, exantema polimórfico e linfadenopatia cervical unilateral > 1,5cm. Qual é o diagnóstico mais provável?",
    options: [
      { label: "A", text: "Escarlatina", isCorrect: false },
      { label: "B", text: "Sarampo", isCorrect: false },
      { label: "C", text: "Doença de Kawasaki", isCorrect: true },
      { label: "D", text: "Mononucleose infecciosa", isCorrect: false },
    ],
    explanation: "A Doença de Kawasaki é diagnosticada por febre >= 5 dias + 4 de 5 critérios clínicos: conjuntivite, alterações de extremidades, exantema, alterações de lábios/cavidade oral e linfadenopatia cervical.",
    area: "Pediatria",
    hasImage: false,
  },
  {
    id: "q3",
    order: 3,
    text: "Mulher de 35 anos, previamente hígida, apresenta quadro de poliúria, polidipsia e perda ponderal de 8kg em 2 meses. Glicemia de jejum: 280 mg/dL. Qual exame é mais importante para definir a classificação do diabetes nesta paciente?",
    options: [
      { label: "A", text: "Hemoglobina glicada (HbA1c)", isCorrect: false },
      { label: "B", text: "Peptídeo C e anticorpos anti-GAD", isCorrect: true },
      { label: "C", text: "Teste oral de tolerância à glicose (TOTG)", isCorrect: false },
      { label: "D", text: "Perfil lipídico completo", isCorrect: false },
    ],
    explanation: "Em adulto jovem com quadro clássico de diabetes, é fundamental dosar peptídeo C (avalia reserva de insulina) e anti-GAD para diferenciar DM tipo 1 (autoimune) de DM tipo 2.",
    area: "Endocrinologia",
    hasImage: false,
  },
  {
    id: "q4",
    order: 4,
    text: "Homem de 50 anos, etilista crônico, apresenta ascite volumosa, icterícia e circulação colateral visível. Paracentese revela gradiente de albumina soro-ascite (GASA) de 1,5 g/dL. Qual a causa mais provável da ascite?",
    options: [
      { label: "A", text: "Carcinomatose peritoneal", isCorrect: false },
      { label: "B", text: "Hipertensão portal por cirrose hepática", isCorrect: true },
      { label: "C", text: "Síndrome nefrótica", isCorrect: false },
      { label: "D", text: "Peritonite tuberculosa", isCorrect: false },
    ],
    explanation: "GASA >= 1,1 g/dL indica hipertensão portal. No contexto de etilismo crônico com sinais de hepatopatia crônica, a causa mais provável é cirrose hepática alcoólica.",
    area: "Gastroenterologia",
    hasImage: false,
  },
  {
    id: "q5",
    order: 5,
    text: "Paciente de 28 anos, previamente saudável, apresenta cefaleia intensa, rigidez de nuca e febre de 39°C há 12 horas. Líquor: pleocitose com predomínio de polimorfonucleares, glicose baixa e proteína elevada. Qual o tratamento empírico mais adequado?",
    options: [
      { label: "A", text: "Aciclovir intravenoso", isCorrect: false },
      { label: "B", text: "Ceftriaxona intravenosa", isCorrect: true },
      { label: "C", text: "Dexametasona isolada", isCorrect: false },
      { label: "D", text: "Fluconazol intravenoso", isCorrect: false },
    ],
    explanation: "O quadro de meningite bacteriana aguda (pleocitose PMN, hipoglicorraquia, hiperproteinorraquia) em adulto jovem exige antibioticoterapia empírica com cefalosporina de 3a geração (ceftriaxona).",
    area: "Infectologia",
    hasImage: false,
  },
];

/**
 * GET /api/questions?pacoteId=xxx
 * Retorna questões de um pacote (mock por enquanto).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pacoteId = searchParams.get("pacoteId");

  if (!pacoteId) {
    return NextResponse.json(
      { error: "pacoteId é obrigatório" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    questions: mockQuestions,
    total: mockQuestions.length,
  });
}

/**
 * PATCH /api/questions
 * Atualiza uma questão (edição manual pelo admin).
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, text, explanation, options } = body;

    if (!id) {
      return NextResponse.json(
        { error: "id é obrigatório" },
        { status: 400 }
      );
    }

    // Por enquanto apenas retorna sucesso (mock)
    return NextResponse.json({
      success: true,
      message: "Questão atualizada com sucesso",
      data: {
        id,
        ...(text !== undefined && { text }),
        ...(explanation !== undefined && { explanation }),
        ...(options !== undefined && { options }),
      },
    });
  } catch (error) {
    console.error("Erro ao atualizar questão:", error);
    return NextResponse.json(
      { error: "Erro interno ao atualizar questão" },
      { status: 500 }
    );
  }
}
