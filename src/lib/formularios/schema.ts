export type Escala =
  | "1-5"
  | "sim_nao"
  | "texto"
  | "single_choice"
  | "multi_choice"
  | "numerico"
  | "top1"
  | "top3";

export interface Opcao {
  id: string;
  label: string;
}

export interface Pergunta {
  id: string;
  texto: string;
  escala: Escala;
  opcoes?: Opcao[];
  maxSelecoes?: number;
  min?: number;
  max?: number;
}

export const ESCALAS_VALIDAS: Escala[] = [
  "1-5",
  "sim_nao",
  "texto",
  "single_choice",
  "multi_choice",
  "numerico",
  "top1",
  "top3",
];

export function isValidEscala(v: unknown): v is Escala {
  return typeof v === "string" && (ESCALAS_VALIDAS as readonly string[]).includes(v);
}

function isValidOpcoes(v: unknown): v is Opcao[] {
  if (!Array.isArray(v) || v.length === 0) return false;
  return v.every(
    (o) =>
      o &&
      typeof o === "object" &&
      typeof (o as { id?: unknown }).id === "string" &&
      typeof (o as { label?: unknown }).label === "string",
  );
}

export function validatePerguntas(input: unknown): Pergunta[] | null {
  if (!Array.isArray(input)) return null;
  const out: Pergunta[] = [];
  for (const p of input) {
    if (!p || typeof p !== "object") return null;
    const obj = p as Record<string, unknown>;
    if (typeof obj.id !== "string" || typeof obj.texto !== "string" || !isValidEscala(obj.escala)) {
      return null;
    }
    const pergunta: Pergunta = { id: obj.id, texto: obj.texto, escala: obj.escala };
    const requiresOpcoes =
      obj.escala === "single_choice" ||
      obj.escala === "multi_choice" ||
      obj.escala === "top1" ||
      obj.escala === "top3";
    if (requiresOpcoes) {
      if (!isValidOpcoes(obj.opcoes)) return null;
      pergunta.opcoes = obj.opcoes;
    }
    if (obj.escala === "multi_choice") {
      const n = obj.maxSelecoes;
      if (typeof n === "number" && n > 0) pergunta.maxSelecoes = n;
    }
    if (obj.escala === "numerico") {
      if (typeof obj.min === "number") pergunta.min = obj.min;
      if (typeof obj.max === "number") pergunta.max = obj.max;
    }
    out.push(pergunta);
  }
  return out;
}

export function renderOpcoesNumeradas(opcoes: Opcao[]): string {
  return opcoes.map((o, i) => `*${i + 1})* ${o.label}`).join("\n");
}

export interface ValidacaoResposta {
  ok: boolean;
  erro?: string;
  valor?: string | string[] | number;
  opcoesEscolhidasIds?: string[];
}

export function validarResposta(p: Pergunta, raw: string): ValidacaoResposta {
  const t = raw.trim();
  if (p.escala === "1-5") {
    if (!/^[1-5]$/.test(t)) return { ok: false, erro: "Responda com um número de *1* a *5*." };
    return { ok: true, valor: t };
  }
  if (p.escala === "sim_nao") {
    if (!/^[sn]$/i.test(t)) return { ok: false, erro: "Responda *S* (sim) ou *N* (não)." };
    return { ok: true, valor: t.toUpperCase() };
  }
  if (p.escala === "texto") {
    if (!t) return { ok: false, erro: "Resposta vazia. Manda um texto curto." };
    return { ok: true, valor: t };
  }
  if (p.escala === "numerico") {
    if (!/^-?\d+$/.test(t)) return { ok: false, erro: "Responda só com um número inteiro." };
    const n = Number(t);
    if (typeof p.min === "number" && n < p.min) return { ok: false, erro: `Valor mínimo: ${p.min}.` };
    if (typeof p.max === "number" && n > p.max) return { ok: false, erro: `Valor máximo: ${p.max}.` };
    return { ok: true, valor: n };
  }
  if (p.escala === "single_choice" || p.escala === "top1") {
    if (!/^\d+$/.test(t)) return { ok: false, erro: "Responda com o *número* da opção." };
    const i = Number(t);
    const opcoes = p.opcoes ?? [];
    if (i < 1 || i > opcoes.length) return { ok: false, erro: `Escolha entre *1* e *${opcoes.length}*.` };
    return { ok: true, valor: opcoes[i - 1].id, opcoesEscolhidasIds: [opcoes[i - 1].id] };
  }
  if (p.escala === "multi_choice") {
    if (!/^\d+(,\s*\d+)*$/.test(t)) {
      return { ok: false, erro: "Responda com os *números* das opções separados por vírgula. Ex: *1,3*" };
    }
    const opcoes = p.opcoes ?? [];
    const nums = t.split(",").map((s) => Number(s.trim()));
    const seen = new Set<number>();
    for (const n of nums) {
      if (n < 1 || n > opcoes.length) return { ok: false, erro: `Cada opção entre *1* e *${opcoes.length}*.` };
      if (seen.has(n)) return { ok: false, erro: "Sem repetir opções." };
      seen.add(n);
    }
    if (typeof p.maxSelecoes === "number" && nums.length > p.maxSelecoes) {
      return { ok: false, erro: `Máximo *${p.maxSelecoes}* opções.` };
    }
    const ids = nums.map((n) => opcoes[n - 1].id);
    return { ok: true, valor: ids, opcoesEscolhidasIds: ids };
  }
  // top3 é tratado externamente (state machine por posição)
  return { ok: false, erro: "Tipo de pergunta não suportado neste handler." };
}
