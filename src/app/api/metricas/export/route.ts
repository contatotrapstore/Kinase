import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin, UnauthorizedError } from "@/lib/auth/require-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface OpcaoMeta { id: string; label: string }
interface PerguntaMeta { id: string; texto: string; escala: string; opcoes?: OpcaoMeta[] }
interface FormularioMeta { id: string; tipo: 'pre' | 'pos'; perguntas: PerguntaMeta[] }

/**
 * GET /api/metricas/export
 * CSV completo: 1 linha por usuário com identificação + engajamento + desempenho
 * + lembretes + comandos + feedback per-bloco + respostas pré e pós-teste.
 * Auth: admin. UTF-8 BOM pra Excel.
 */
export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any;

  // 1. Formulários ATIVOS (pra saber as colunas pré_* e pos_*)
  const { data: formulariosRaw } = await supabase
    .from('formularios')
    .select('id, tipo, perguntas')
    .eq('ativo', true);
  const formularios: FormularioMeta[] = formulariosRaw ?? [];
  const preForm = formularios.find((f) => f.tipo === 'pre');
  const posForm = formularios.find((f) => f.tipo === 'pos');

  // 2. Usuários + agregados
  const { data: usuarios } = await supabase
    .from('usuarios')
    .select('id, phone, name, grupo_experimental, created_at, experimento_started_at');
  const users = (usuarios ?? []) as Array<{
    id: string; phone: string; name: string | null; grupo_experimental: string | null;
    created_at: string; experimento_started_at: string | null;
  }>;
  const userIds = users.map((u) => u.id);

  // 3. Disparos paralelos pra agregados
  const [respostasRes, motRes, logsRes, blockFbRes, formRespRes] = await Promise.all([
    supabase.from('respostas').select('usuario_id, is_correct, difficulty_rating, answered_at').in('usuario_id', userIds.length ? userIds : ['__none__']),
    supabase.from('motivacional_envios').select('usuario_id, respondeu_apos').in('usuario_id', userIds.length ? userIds : ['__none__']),
    supabase.from('whatsapp_log').select('parsed_phone, parsed_text, action').eq('action', 'received'),
    supabase.from('block_feedback').select('usuario_id, rating').in('usuario_id', userIds.length ? userIds : ['__none__']),
    supabase.from('formularios_respostas').select('usuario_id, formulario_id, respostas, concluido_at'),
  ]);

  // 4. Agrega por usuário
  type Agg = {
    totalResp: number; corretas: number; F: number; M: number; D: number;
    primeira: string | null; ultima: string | null; diasAtivos: Set<string>;
    lembretes: number; lembretesRetorno: number;
    rankViews: number; progViews: number; ajudaViews: number;
    bfUseful: number; bfNotUseful: number; bfSkipped: number;
  };
  const agg = new Map<string, Agg>();
  const phoneToId = new Map<string, string>();
  for (const u of users) {
    phoneToId.set(u.phone, u.id);
    agg.set(u.id, {
      totalResp: 0, corretas: 0, F: 0, M: 0, D: 0,
      primeira: null, ultima: null, diasAtivos: new Set(),
      lembretes: 0, lembretesRetorno: 0,
      rankViews: 0, progViews: 0, ajudaViews: 0,
      bfUseful: 0, bfNotUseful: 0, bfSkipped: 0,
    });
  }

  for (const r of (respostasRes.data ?? []) as Array<{ usuario_id: string; is_correct: boolean | null; difficulty_rating: string | null; answered_at: string }>) {
    const a = agg.get(r.usuario_id);
    if (!a) continue;
    a.totalResp += 1;
    if (r.is_correct) a.corretas += 1;
    if (r.difficulty_rating === 'F') a.F += 1;
    else if (r.difficulty_rating === 'M') a.M += 1;
    else if (r.difficulty_rating === 'D') a.D += 1;
    if (r.answered_at) {
      const dia = r.answered_at.slice(0, 10);
      a.diasAtivos.add(dia);
      if (!a.primeira || r.answered_at < a.primeira) a.primeira = r.answered_at;
      if (!a.ultima || r.answered_at > a.ultima) a.ultima = r.answered_at;
    }
  }
  for (const m of (motRes.data ?? []) as Array<{ usuario_id: string; respondeu_apos: boolean | null }>) {
    const a = agg.get(m.usuario_id);
    if (!a) continue;
    a.lembretes += 1;
    if (m.respondeu_apos) a.lembretesRetorno += 1;
  }
  for (const log of (logsRes.data ?? []) as Array<{ parsed_phone: string; parsed_text: string | null }>) {
    const uid = phoneToId.get(log.parsed_phone ?? '');
    if (!uid) continue;
    const a = agg.get(uid);
    if (!a) continue;
    const t = (log.parsed_text ?? '').toLowerCase().trim();
    if (t === '/ranking') a.rankViews += 1;
    else if (t === '/progresso') a.progViews += 1;
    else if (t === '/ajuda' || t === '/help') a.ajudaViews += 1;
  }
  for (const bf of (blockFbRes.data ?? []) as Array<{ usuario_id: string; rating: string }>) {
    const a = agg.get(bf.usuario_id);
    if (!a) continue;
    if (bf.rating === 'useful') a.bfUseful += 1;
    else if (bf.rating === 'not_useful') a.bfNotUseful += 1;
    else a.bfSkipped += 1;
  }

  // 5. Respostas dos formulários por user
  type FormResp = { respostas: Record<string, unknown>; concluido_at: string | null };
  const preByUser = new Map<string, FormResp>();
  const posByUser = new Map<string, FormResp>();
  for (const fr of (formRespRes.data ?? []) as Array<{ usuario_id: string; formulario_id: string; respostas: Record<string, unknown>; concluido_at: string | null }>) {
    if (preForm && fr.formulario_id === preForm.id) {
      preByUser.set(fr.usuario_id, { respostas: fr.respostas ?? {}, concluido_at: fr.concluido_at });
    } else if (posForm && fr.formulario_id === posForm.id) {
      posByUser.set(fr.usuario_id, { respostas: fr.respostas ?? {}, concluido_at: fr.concluido_at });
    }
  }

  // 6. Resolve label de opção (single/multi/top1/top3 gravam id; resolvemos pro texto humano)
  function resolveAnswer(p: PerguntaMeta, raw: unknown): string {
    if (raw === null || raw === undefined) return '';
    const opcoes = p.opcoes ?? [];
    const opMap = new Map(opcoes.map((o) => [o.id, o.label]));
    if (Array.isArray(raw)) {
      return raw.map((id) => opMap.get(String(id)) ?? String(id)).join(' | ');
    }
    if (typeof raw === 'string' && opMap.has(raw)) return opMap.get(raw)!;
    return String(raw);
  }

  // 7. Monta colunas dinâmicas
  const preCols = (preForm?.perguntas ?? []).map((p) => `pre_${p.id}`);
  const posCols = (posForm?.perguntas ?? []).map((p) => `pos_${p.id}`);

  const baseCols = [
    'phone','name','grupo_experimental','cadastrado_em',
    'experimento_started_at','dias_no_experimento','experimento_status',
    'total_respostas','taxa_acerto_pct','dias_ativos','primeira_resp','ultima_atividade',
    'F_count','M_count','D_count',
    'lembretes_enviados','lembretes_retorno_24h',
    'ranking_views','progresso_views','ajuda_views',
    'block_feedback_useful','block_feedback_not_useful','block_feedback_skipped',
    'pre_concluido_at','pos_concluido_at',
  ];

  const header = [...baseCols, ...preCols, ...posCols];

  function csvEscape(v: unknown): string {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (s.includes('"') || s.includes(',') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  const rows: string[] = [header.join(',')];

  for (const u of users) {
    const a = agg.get(u.id)!;
    const dias = u.experimento_started_at
      ? Math.floor((Date.now() - new Date(u.experimento_started_at).getTime()) / 86400000)
      : null;
    let status = 'pendente';
    if (u.experimento_started_at) {
      if (dias! < 14) status = 'em_andamento';
      else status = 'concluido';
    }
    const taxa = a.totalResp ? Math.round((100 * a.corretas) / a.totalResp) : 0;
    const pre = preByUser.get(u.id);
    const pos = posByUser.get(u.id);

    const base: unknown[] = [
      u.phone, u.name ?? '', u.grupo_experimental ?? '', u.created_at,
      u.experimento_started_at ?? '', dias ?? '', status,
      a.totalResp, taxa, a.diasAtivos.size, a.primeira ?? '', a.ultima ?? '',
      a.F, a.M, a.D,
      a.lembretes, a.lembretesRetorno,
      a.rankViews, a.progViews, a.ajudaViews,
      a.bfUseful, a.bfNotUseful, a.bfSkipped,
      pre?.concluido_at ?? '', pos?.concluido_at ?? '',
    ];

    const preVals = (preForm?.perguntas ?? []).map((p) =>
      resolveAnswer(p, pre?.respostas?.[p.id]),
    );
    const posVals = (posForm?.perguntas ?? []).map((p) =>
      resolveAnswer(p, pos?.respostas?.[p.id]),
    );

    rows.push([...base, ...preVals, ...posVals].map(csvEscape).join(','));
  }

  const BOM = '﻿';
  const csv = BOM + rows.join('\n');
  const filename = `kinase-export-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
