"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  BarChart,
  PieChart,
  Line,
  Bar,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  Download,
  Loader2,
  Users,
  Target,
  Bell,
  MessageSquare,
  ThumbsUp,
  TrendingUp,
  Activity,
  Filter,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface UsoRow {
  dia: string;
  cadastrados_cumulativo: number;
  ativos_no_dia: number;
  novos_no_dia: number;
}

interface QuestoesRow {
  total_respondidas: number;
  usuarios_responderam: number;
  media_por_usuario: number;
  media_por_dia: number;
  acertos: number;
  taxa_acerto_pct: number;
}

interface RetencaoRow {
  cohort: string;
  retidos_d1: number;
  retidos_d3: number;
  retidos_d7: number;
  retidos_d14: number;
  retidos_d21: number;
}

interface LembretesRow {
  dia: string;
  total_enviados: number;
  retornos: number;
  taxa_retorno_pct: number;
}

interface DificuldadeRow {
  difficulty_rating: string;
  total: number;
  acertos: number;
  erros: number;
  taxa_acerto_pct: number;
}

interface ComandosRow {
  comando: string;
  total_usos: number;
  usuarios_distintos: number;
}

interface ExplicacoesRow {
  uteis: number;
  nao_uteis: number;
  puladas: number;
  total_avaliadas: number;
  pct_uteis: number;
}

interface AtividadeRow {
  usuario_id: string;
  phone: string;
  name: string | null;
  grupo_experimental: string | null;
  created_at: string;
  ultima_interacao: string | null;
  total_respostas: number;
}

interface MetricasResponse {
  uso: UsoRow[];
  questoes: QuestoesRow | null;
  retencao: RetencaoRow[];
  lembretes: LembretesRow[];
  dificuldade: DificuldadeRow[];
  comandos: ComandosRow[];
  explicacoes: ExplicacoesRow | null;
  ultimaAtividade: AtividadeRow[];
  grupos: string[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "nunca";
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "agora mesmo";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `há ${diffD}d`;
  const diffMo = Math.floor(diffD / 30);
  return `há ${diffMo}mo`;
}

function formatDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });
  } catch {
    return d;
  }
}

function formatPct(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${Number(v).toFixed(1)}%`;
}

function formatNumber(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return new Intl.NumberFormat("pt-BR").format(Number(v));
}

function downloadCsv(rows: AtividadeRow[], filename: string) {
  const header = [
    "phone",
    "name",
    "grupo_experimental",
    "created_at",
    "ultima_interacao",
    "total_respostas",
  ];
  const escape = (v: unknown) => {
    if (v == null) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.phone,
        r.name ?? "",
        r.grupo_experimental ?? "",
        r.created_at ?? "",
        r.ultima_interacao ?? "",
        r.total_respostas ?? 0,
      ]
        .map(escape)
        .join(","),
    ),
  ];
  const csv = "﻿" + lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/*  Palette                                                            */
/* ------------------------------------------------------------------ */

const COLORS = {
  primary: "#3b82f6",
  secondary: "#10b981",
  accent: "#f59e0b",
  danger: "#ef4444",
  muted: "#94a3b8",
};

const PIE_COLORS = ["#10b981", "#ef4444", "#94a3b8"];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function MetricasPage() {
  const [data, setData] = useState<MetricasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [grupo, setGrupo] = useState<string>("todos");

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const url =
          grupo && grupo !== "todos"
            ? `/api/metricas?grupo=${encodeURIComponent(grupo)}`
            : "/api/metricas";
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = (await res.json()) as MetricasResponse;
        if (!cancelled) setData(json);
      } catch (err) {
        console.error("Métricas fetch error:", err);
        if (!cancelled)
          setError("Erro ao carregar métricas. Verifique sua conexão.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [grupo]);

  const usoChart = useMemo(
    () =>
      (data?.uso ?? []).map((r) => ({
        dia: formatDate(r.dia),
        Cadastrados: r.cadastrados_cumulativo,
        Ativos: r.ativos_no_dia,
      })),
    [data],
  );

  const retencaoChart = useMemo(() => {
    const rows = data?.retencao ?? [];
    if (rows.length === 0) return [];
    // Agrega média por bucket D para visão global
    const agg = rows.reduce(
      (acc, r) => {
        acc.D1 += r.retidos_d1 ?? 0;
        acc.D3 += r.retidos_d3 ?? 0;
        acc.D7 += r.retidos_d7 ?? 0;
        acc.D14 += r.retidos_d14 ?? 0;
        acc.D21 += r.retidos_d21 ?? 0;
        return acc;
      },
      { D1: 0, D3: 0, D7: 0, D14: 0, D21: 0 },
    );
    return [
      { dia: "D1", retidos: agg.D1 },
      { dia: "D3", retidos: agg.D3 },
      { dia: "D7", retidos: agg.D7 },
      { dia: "D14", retidos: agg.D14 },
      { dia: "D21", retidos: agg.D21 },
    ];
  }, [data]);

  const lembretesChart = useMemo(
    () =>
      (data?.lembretes ?? []).map((r) => ({
        dia: formatDate(r.dia),
        Enviados: r.total_enviados,
        Retornos: r.retornos,
        Taxa: r.taxa_retorno_pct,
      })),
    [data],
  );

  const dificuldadeChart = useMemo(
    () =>
      (data?.dificuldade ?? []).map((r) => ({
        dificuldade:
          r.difficulty_rating === "F"
            ? "Fácil"
            : r.difficulty_rating === "M"
              ? "Média"
              : r.difficulty_rating === "D"
                ? "Difícil"
                : r.difficulty_rating,
        Acertos: r.acertos,
        Erros: r.erros,
      })),
    [data],
  );

  const comandosChart = useMemo(
    () =>
      (data?.comandos ?? []).slice(0, 10).map((r) => ({
        comando: r.comando,
        Usos: r.total_usos,
      })),
    [data],
  );

  const explicacoesPie = useMemo(() => {
    const e = data?.explicacoes;
    if (!e) return [];
    return [
      { name: "Úteis", value: e.uteis ?? 0 },
      { name: "Não úteis", value: e.nao_uteis ?? 0 },
      { name: "Puladas", value: e.puladas ?? 0 },
    ];
  }, [data]);

  /* ---- Loading state ---- */
  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">
          Carregando métricas...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ---------- Header + Filtro + Export ---------- */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Métricas
          </h1>
          <p className="text-sm text-muted-foreground">
            Visão consolidada do uso da plataforma.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={grupo}
              onChange={(e) => setGrupo(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              aria-label="Filtrar por grupo experimental"
            >
              <option value="todos">Todos os grupos</option>
              {(data?.grupos ?? []).map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <Button
            variant="outline"
            onClick={() =>
              downloadCsv(
                data?.ultimaAtividade ?? [],
                `metricas-atividade-${new Date().toISOString().slice(0, 10)}.csv`,
              )
            }
            disabled={!data?.ultimaAtividade?.length}
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ---------- Grid de cards ---------- */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* (a) Cadastros e ativos por dia */}
        <Card className="md:col-span-2 lg:col-span-2">
          <CardHeader className="flex flex-row items-center gap-2">
            <Users className="h-4 w-4 text-blue-500" />
            <CardTitle className="text-base">
              Cadastros e ativos por dia
            </CardTitle>
          </CardHeader>
          <CardContent>
            {usoChart.length === 0 ? (
              <EmptyState label="Sem dados de uso ainda." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={usoChart}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e2e8f0"
                  />
                  <XAxis
                    dataKey="dia"
                    tick={{ fontSize: 11 }}
                    stroke="#64748b"
                  />
                  <YAxis tick={{ fontSize: 11 }} stroke="#64748b" />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="Cadastrados"
                    stroke={COLORS.primary}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="Ativos"
                    stroke={COLORS.secondary}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* (b) Total de questões */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Target className="h-4 w-4 text-violet-500" />
            <CardTitle className="text-base">Total de questões</CardTitle>
          </CardHeader>
          <CardContent>
            {!data?.questoes ? (
              <EmptyState label="Sem questões respondidas." />
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Total respondidas
                  </p>
                  <p className="text-3xl font-bold">
                    {formatNumber(data.questoes.total_respondidas)}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 border-t pt-3">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Média / usuário
                    </p>
                    <p className="text-lg font-semibold">
                      {data.questoes.media_por_usuario != null
                        ? Number(data.questoes.media_por_usuario).toFixed(1)
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Taxa de acerto
                    </p>
                    <p className="text-lg font-semibold text-emerald-600">
                      {formatPct(data.questoes.taxa_acerto_pct)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* (c) Retenção */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            <CardTitle className="text-base">Retenção por cohort</CardTitle>
          </CardHeader>
          <CardContent>
            {retencaoChart.length === 0 ? (
              <EmptyState label="Sem cohorts ainda." />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={retencaoChart}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e2e8f0"
                  />
                  <XAxis
                    dataKey="dia"
                    tick={{ fontSize: 11 }}
                    stroke="#64748b"
                  />
                  <YAxis tick={{ fontSize: 11 }} stroke="#64748b" />
                  <Tooltip />
                  <Bar
                    dataKey="retidos"
                    fill={COLORS.secondary}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* (d) Lembretes */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Bell className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-base">Lembretes</CardTitle>
          </CardHeader>
          <CardContent>
            {lembretesChart.length === 0 ? (
              <EmptyState label="Sem lembretes registrados." />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={lembretesChart}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e2e8f0"
                  />
                  <XAxis
                    dataKey="dia"
                    tick={{ fontSize: 11 }}
                    stroke="#64748b"
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11 }}
                    stroke="#64748b"
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11 }}
                    stroke="#64748b"
                    unit="%"
                  />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar
                    yAxisId="left"
                    dataKey="Enviados"
                    fill={COLORS.primary}
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="Taxa"
                    stroke={COLORS.accent}
                    strokeWidth={2}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* (e) Dificuldade x Acerto */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Activity className="h-4 w-4 text-rose-500" />
            <CardTitle className="text-base">
              Dificuldade × Acerto
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dificuldadeChart.length === 0 ? (
              <EmptyState label="Sem dados de dificuldade." />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dificuldadeChart}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e2e8f0"
                  />
                  <XAxis
                    dataKey="dificuldade"
                    tick={{ fontSize: 11 }}
                    stroke="#64748b"
                  />
                  <YAxis tick={{ fontSize: 11 }} stroke="#64748b" />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar
                    dataKey="Acertos"
                    fill={COLORS.secondary}
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="Erros"
                    fill={COLORS.danger}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* (f) Comandos usados */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <MessageSquare className="h-4 w-4 text-indigo-500" />
            <CardTitle className="text-base">Comandos usados</CardTitle>
          </CardHeader>
          <CardContent>
            {comandosChart.length === 0 ? (
              <EmptyState label="Nenhum comando registrado." />
            ) : (
              <ResponsiveContainer
                width="100%"
                height={Math.max(220, comandosChart.length * 30)}
              >
                <BarChart
                  data={comandosChart}
                  layout="vertical"
                  margin={{ left: 20 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e2e8f0"
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11 }}
                    stroke="#64748b"
                  />
                  <YAxis
                    type="category"
                    dataKey="comando"
                    tick={{ fontSize: 11 }}
                    stroke="#64748b"
                    width={80}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="Usos"
                    fill={COLORS.primary}
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* (g) Avaliação de explicações */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <ThumbsUp className="h-4 w-4 text-cyan-500" />
            <CardTitle className="text-base">
              Avaliação de explicações
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!data?.explicacoes || explicacoesPie.every((p) => p.value === 0) ? (
              <EmptyState label="Sem avaliações ainda." />
            ) : (
              <div className="flex flex-col items-center gap-3">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={explicacoesPie}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      innerRadius={40}
                    >
                      {explicacoesPie.map((_, i) => (
                        <Cell
                          key={`cell-${i}`}
                          fill={PIE_COLORS[i % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">
                    % consideradas úteis
                  </p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {formatPct(data.explicacoes.pct_uteis)}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* (h) Última atividade por usuário */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">
            Última atividade por usuário
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(data?.ultimaAtividade ?? []).length === 0 ? (
            <EmptyState label="Sem usuários para exibir." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Grupo</TableHead>
                    <TableHead className="text-right">Respostas</TableHead>
                    <TableHead>Última interação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.ultimaAtividade ?? [])
                    .slice(0, 100)
                    .map((u) => (
                      <TableRow key={u.usuario_id}>
                        <TableCell className="font-mono text-xs">
                          {u.phone}
                        </TableCell>
                        <TableCell className="text-sm">
                          {u.name ?? "—"}
                        </TableCell>
                        <TableCell>
                          {u.grupo_experimental ? (
                            <Badge variant="outline">
                              {u.grupo_experimental}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {u.total_respostas ?? 0}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {timeAgo(u.ultima_interacao)}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              {(data?.ultimaAtividade ?? []).length > 100 && (
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Mostrando 100 de {data?.ultimaAtividade.length}. Use o
                  CSV para a lista completa.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}
