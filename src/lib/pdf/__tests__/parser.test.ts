import { describe, it, expect } from "vitest";
import { parsePdfText, detectAreaConhecimento } from "../parser";

// ---------------------------------------------------------------------------
// detectAreaConhecimento
// ---------------------------------------------------------------------------

describe("detectAreaConhecimento", () => {
  it("detecta áreas conhecidas em maiúsculas", () => {
    expect(detectAreaConhecimento("CARDIOLOGIA")).toBe("CARDIOLOGIA");
    expect(detectAreaConhecimento("PEDIATRIA")).toBe("PEDIATRIA");
    expect(detectAreaConhecimento("CLÍNICA MÉDICA")).toBe("CLÍNICA MÉDICA");
  });

  it("rejeita texto longo ou com minúsculas", () => {
    expect(detectAreaConhecimento("Cardiologia")).toBeNull();
    expect(
      detectAreaConhecimento("Este é um texto longo que não é uma área")
    ).toBeNull();
  });

  it("rejeita linha vazia", () => {
    expect(detectAreaConhecimento("")).toBeNull();
    expect(detectAreaConhecimento("   ")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parsePdfText — formato questão com alternativas (ENAMED / provas)
// ---------------------------------------------------------------------------

describe("parsePdfText — formato questão com alternativas", () => {
  it("parseia questão simples com A) B) C) D) e gabarito", () => {
    const text = `1. Qual é o mecanismo de ação do Omeprazol?
A) Inibidor da bomba de prótons
B) Antagonista H2
C) Antiácido
D) Procinético

Gabarito: A`;

    const questions = parsePdfText(text);
    expect(questions).toHaveLength(1);
    expect(questions[0].order).toBe(1);
    expect(questions[0].options).toHaveLength(4);
    expect(questions[0].options[0].isCorrect).toBe(true);
    expect(questions[0].options[0].label).toBe("A");
    expect(questions[0].options[0].text).toContain("Inibidor");
  });

  it("parseia múltiplas questões", () => {
    const text = `1. Primeira questão?
A) Opção A
B) Opção B
C) Opção C
D) Opção D

Gabarito: B

2. Segunda questão?
A) Opção A
B) Opção B
C) Opção C
D) Opção D

Gabarito: C`;

    const questions = parsePdfText(text);
    expect(questions).toHaveLength(2);
    expect(questions[0].options.find((o) => o.isCorrect)?.label).toBe("B");
    expect(questions[1].options.find((o) => o.isCorrect)?.label).toBe("C");
  });

  it("parseia questão com COMENTÁRIO e Gabarito", () => {
    const text = `1. Questão sobre farmacologia?
A) Opção A
B) Opção B
C) Opção C
D) Opção D

COMENTÁRIO: O omeprazol é um IBP. Gabarito: A`;

    const questions = parsePdfText(text);
    expect(questions).toHaveLength(1);
    expect(questions[0].explanation).toContain("omeprazol");
    expect(questions[0].options.find((o) => o.isCorrect)?.label).toBe("A");
  });

  it("detecta questões com imagem", () => {
    const text = `1. Analise o ECG abaixo e indique o diagnóstico.
A) IAM
B) BRE
C) Normal
D) FA

Gabarito: A`;

    const questions = parsePdfText(text);
    expect(questions[0].hasImage).toBe(true);
  });

  it("retorna array vazio para texto sem questões", () => {
    const text = "Texto qualquer sem formato de questão nenhuma.";
    expect(parsePdfText(text)).toHaveLength(0);
  });

  it("aplica gabarito externo (lista separada)", () => {
    const text = `1. Primeira questão?
A) Opção A
B) Opção B
C) Opção C
D) Opção D

2. Segunda questão?
A) Opção A
B) Opção B
C) Opção C
D) Opção D

Gabarito:
1-A
2-C`;

    const questions = parsePdfText(text);
    // As 2 primeiras questões devem ter respostas corretas do gabarito
    const q1 = questions.find((q) => q.order === 1);
    const q2 = questions.find((q) => q.order === 2);
    expect(q1).toBeDefined();
    expect(q2).toBeDefined();
    expect(q1!.options.find((o) => o.isCorrect)?.label).toBe("A");
    expect(q2!.options.find((o) => o.isCorrect)?.label).toBe("C");
  });
});

// ---------------------------------------------------------------------------
// parsePdfText — formato gabarito comentado (Estratégia MED)
// ---------------------------------------------------------------------------

describe("parsePdfText — formato gabarito comentado", () => {
  const gabaritoText = `T e le gra m : @k iw ifz
CURSOS DE MEDICINA

-- 1 of 2 --

A C B D
Legenda:
! Questão Anulada * Questão Dissertativa
6 - 2022 SUS - SP
A banca copiou e colou informações. O valsartan é um bloqueador de receptor de angiotensina II e o sacubitril é um inibidor de neprilisina. Resposta: letra A.
Video comentário: 310963
7 - 2022 HSJC - SP
Vamos analisar as afirmativas: A) Incorreta. A ansiedade são achados inespecíficos. B) Incorreta. Edema de membros inferiores crônico. C) Correta. O início SÚBITO de confusão mental. D) Incorreta. O estreitamento arteriolar isolado. Resposta: letra C.
Video comentário: 317068
8 - 2022 SUS - SP
Questão decoreba sobre critérios de Framingham. Critérios maiores incluem dispneia paroxística noturna e turgência jugular. Resposta: letra B.
9 - 2022 HSL - SP
Os inibidores de SGLT2 promovem diurese osmótica. LETRAS B e C CORRETAS. LETRA D CORRETA. LETRA A CORRETA. LETRA E INCORRETA. Resposta: letra D.`;

  it("detecta formato gabarito e parseia questões", () => {
    const questions = parsePdfText(gabaritoText);
    expect(questions.length).toBeGreaterThanOrEqual(4);
  });

  it("extrai número e referência da questão", () => {
    const questions = parsePdfText(gabaritoText);
    const q6 = questions.find((q) => q.order === 6);
    expect(q6).toBeDefined();
    expect(q6!.reference).toContain("2022 SUS - SP");
  });

  it("usa grid de respostas para determinar resposta correta", () => {
    const questions = parsePdfText(gabaritoText);
    const q6 = questions.find((q) => q.order === 6);
    expect(q6).toBeDefined();
    expect(q6!.options.find((o) => o.isCorrect)?.label).toBe("A");
  });

  it("extrai alternativas inline (A) Incorreta / C) Correta)", () => {
    const questions = parsePdfText(gabaritoText);
    const q7 = questions.find((q) => q.order === 7);
    expect(q7).toBeDefined();
    expect(q7!.options.length).toBeGreaterThanOrEqual(2);
    expect(q7!.options.find((o) => o.isCorrect)?.label).toBe("C");
  });

  it("cria placeholder options quando não há alternativas inline", () => {
    const questions = parsePdfText(gabaritoText);
    const q8 = questions.find((q) => q.order === 8);
    expect(q8).toBeDefined();
    expect(q8!.options).toHaveLength(4);
    expect(q8!.options.find((o) => o.isCorrect)?.label).toBe("B");
  });

  it("extrai Resposta: letra X corretamente", () => {
    const questions = parsePdfText(gabaritoText);
    const q9 = questions.find((q) => q.order === 9);
    expect(q9).toBeDefined();
    expect(q9!.options.find((o) => o.isCorrect)?.label).toBe("D");
  });

  it("remove Video comentário do texto", () => {
    const questions = parsePdfText(gabaritoText);
    const q6 = questions.find((q) => q.order === 6);
    expect(q6!.text).not.toContain("Video");
    expect(q6!.text).not.toContain("310963");
  });

  it("armazena explicação completa", () => {
    const questions = parsePdfText(gabaritoText);
    const q6 = questions.find((q) => q.order === 6);
    expect(q6!.explanation).toContain("valsartan");
    expect(q6!.explanation).toContain("sacubitril");
  });
});
