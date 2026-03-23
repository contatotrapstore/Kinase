"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Users,
  BookOpen,
  HelpCircle,
  TrendingUp,
  Activity,
  Trophy,
  Clock,
  Loader2,
  Inbox,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface RankingEntry {
  total_score: number;
  accuracy_pct: number;
  usuarios: { name: string | null; phone: string } | null;
}

interface ActivityEntry {
  id: string;
  is_correct: boolean;
  answered_at: string;
  usuarios: { name: string | null } | null;
  questoes: { text: string } | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function positionBadge(position: number) {
  if (position === 1)
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700">
        1
      </span>
    );
  if (position === 2)
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-gray-600">
        2
      </span>
    );
  if (position === 3)
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-sm font-bold text-orange-700">
        3
      </span>
    );
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center text-sm font-semibold text-muted-foreground">
      {position}
    </span>
  );
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "agora mesmo";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `há ${diffD}d`;
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPacotes, setTotalPacotes] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [avgAccuracy, setAvgAccuracy] = useState<number | null>(null);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    const supabase = createClient();

    async function fetchData() {
      try {
        const [usersRes, pacotesRes, questoesRes, rankingsAccRes, rankingRes, activityRes] =
          await Promise.all([
            supabase.from("usuarios").select("*", { count: "exact", head: true }),
            supabase.from("pacotes").select("*", { count: "exact", head: true }),
            supabase.from("questoes").select("*", { count: "exact", head: true }),
            supabase.from("rankings").select("accuracy_pct"),
            supabase
              .from("rankings")
              .select("*, usuarios(name, phone)")
              .order("total_score", { ascending: false })
              .limit(5),
            supabase
              .from("respostas")
              .select("*, usuarios(name), questoes(text)")
              .order("answered_at", { ascending: false })
              .limit(5),
          ]);

        setTotalUsers(usersRes.count ?? 0);
        setTotalPacotes(pacotesRes.count ?? 0);
        setTotalQuestions(questoesRes.count ?? 0);

        // Calculate average accuracy
        if (rankingsAccRes.data && rankingsAccRes.data.length > 0) {
          const sum = rankingsAccRes.data.reduce(
            (acc: number, r: { accuracy_pct: number }) => acc + r.accuracy_pct,
            0,
          );
          setAvgAccuracy(sum / rankingsAccRes.data.length);
        } else {
          setAvgAccuracy(null);
        }

        setRanking((rankingRes.data as unknown as RankingEntry[]) ?? []);
        setRecentActivity((activityRes.data as unknown as ActivityEntry[]) ?? []);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  /* ---- Stats config ---- */
  const stats = [
    {
      label: "Total Usuarios",
      value: String(totalUsers),
      icon: Users,
      color: "text-blue-600 bg-blue-100",
      trend: totalUsers === 0 ? "Nenhum dado ainda" : `${totalUsers} cadastrado(s)`,
    },
    {
      label: "Pacotes",
      value: String(totalPacotes),
      icon: BookOpen,
      color: "text-emerald-600 bg-emerald-100",
      trend: totalPacotes === 0 ? "Nenhum dado ainda" : `${totalPacotes} pacote(s)`,
    },
    {
      label: "Questoes",
      value: String(totalQuestions),
      icon: HelpCircle,
      color: "text-violet-600 bg-violet-100",
      trend: totalQuestions === 0 ? "Nenhum dado ainda" : `${totalQuestions} questao(es)`,
    },
    {
      label: "Taxa de Acerto",
      value: avgAccuracy !== null ? `${avgAccuracy.toFixed(1)}%` : "0%",
      icon: TrendingUp,
      color: "text-amber-600 bg-amber-100",
      trend: avgAccuracy === null ? "Nenhum dado ainda" : "Media geral",
    },
  ];

  /* ---- Loading state ---- */
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">Carregando dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ---------- Stats grid ---------- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${stat.color}`}
              >
                <stat.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold text-foreground">
                  {stat.value}
                </p>
                <p className="truncate text-xs text-muted-foreground/70">
                  {stat.trend}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ---------- Two-column section ---------- */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---- Atividade Recente ---- */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Atividade Recente</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <Inbox className="mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm font-medium">Nenhuma atividade recente.</p>
                <p className="mt-1 text-xs">
                  Comece fazendo upload de um PDF com questoes.
                </p>
              </div>
            ) : (
              <ul className="space-y-4">
                {recentActivity.map((item) => (
                  <li key={item.id} className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        item.is_correct
                          ? "bg-emerald-100 text-emerald-600"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      <HelpCircle className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {item.usuarios?.name ?? "Usuario"} respondeu{" "}
                        {item.is_correct ? (
                          <span className="font-semibold text-emerald-600">corretamente</span>
                        ) : (
                          <span className="font-semibold text-red-600">incorretamente</span>
                        )}
                      </p>
                      {item.questoes?.text && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground/70">
                          {item.questoes.text.slice(0, 80)}
                          {item.questoes.text.length > 80 ? "..." : ""}
                        </p>
                      )}
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {timeAgo(item.answered_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* ---- Top 5 Ranking ---- */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-base">Top 5 Ranking</CardTitle>
          </CardHeader>
          <CardContent>
            {ranking.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <Trophy className="mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm font-medium">Nenhum dado no ranking ainda.</p>
                <p className="mt-1 text-xs">
                  Os dados aparecerão quando medicos comecarem a responder questoes.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-right">Acerto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranking.map((user, idx) => {
                    const name = user.usuarios?.name ?? user.usuarios?.phone ?? "—";
                    const initials = getInitials(user.usuarios?.name);
                    const acerto = `${user.accuracy_pct.toFixed(0)}%`;
                    return (
                      <TableRow key={idx}>
                        <TableCell className="text-center">
                          {positionBadge(idx + 1)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar size="sm">
                              <AvatarFallback className="text-[10px] font-semibold">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium">{name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {user.total_score}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                              user.accuracy_pct >= 85
                                ? "bg-emerald-100 text-emerald-700"
                                : user.accuracy_pct >= 80
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {acerto}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
