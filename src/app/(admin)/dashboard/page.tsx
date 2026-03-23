"use client";

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
  CheckCircle,
  PlayCircle,
  ClipboardList,
  Medal,
  Upload,
  Clock,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Mock data                                                         */
/* ------------------------------------------------------------------ */

const stats = [
  {
    label: "Total Usuarios",
    value: "47",
    icon: Users,
    color: "text-blue-600 bg-blue-100",
    trend: "+5 este mes",
  },
  {
    label: "Pacotes",
    value: "3",
    icon: BookOpen,
    color: "text-emerald-600 bg-emerald-100",
    trend: "Cardiologia, Cirurgia, Pediatria",
  },
  {
    label: "Questoes",
    value: "150",
    icon: HelpCircle,
    color: "text-violet-600 bg-violet-100",
    trend: "+12 esta semana",
  },
  {
    label: "Taxa de Acerto",
    value: "78.3%",
    icon: TrendingUp,
    color: "text-amber-600 bg-amber-100",
    trend: "+2.1% vs. mes anterior",
  },
];

const recentActivities = [
  {
    id: 1,
    icon: CheckCircle,
    iconColor: "text-emerald-600 bg-emerald-100",
    text: "Dr. Marina Silva completou Pacote Cardiologia",
    detail: "87% acerto",
    time: "ha 2 horas",
  },
  {
    id: 2,
    icon: PlayCircle,
    iconColor: "text-blue-600 bg-blue-100",
    text: "Dr. Carlos Mendes iniciou Pacote Pediatria",
    detail: null,
    time: "ha 5 horas",
  },
  {
    id: 3,
    icon: ClipboardList,
    iconColor: "text-violet-600 bg-violet-100",
    text: "Dr. Ana Costa respondeu 20 questoes",
    detail: "Cirurgia",
    time: "ha 8 horas",
  },
  {
    id: 4,
    icon: Medal,
    iconColor: "text-amber-600 bg-amber-100",
    text: "Dr. Pedro Lima alcancou Top 3 no ranking",
    detail: null,
    time: "ha 1 dia",
  },
  {
    id: 5,
    icon: Upload,
    iconColor: "text-rose-600 bg-rose-100",
    text: "Dr. Juliana Rocha fez upload de novo PDF",
    detail: null,
    time: "ha 1 dia",
  },
];

const ranking = [
  { position: 1, name: "Dr. Marina Silva", initials: "MS", score: 432, acerto: "91%" },
  { position: 2, name: "Dr. Carlos Mendes", initials: "CM", score: 398, acerto: "87%" },
  { position: 3, name: "Dr. Ana Costa", initials: "AC", score: 376, acerto: "84%" },
  { position: 4, name: "Dr. Pedro Lima", initials: "PL", score: 341, acerto: "79%" },
  { position: 5, name: "Dr. Juliana Rocha", initials: "JR", score: 312, acerto: "76%" },
];

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

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
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
            <ul className="space-y-4">
              {recentActivities.map((activity) => (
                <li key={activity.id} className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${activity.iconColor}`}
                  >
                    <activity.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {activity.text}
                      {activity.detail && (
                        <span className="ml-1 font-semibold text-emerald-600">
                          — {activity.detail}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {activity.time}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* ---- Top 5 Ranking ---- */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-base">Top 5 Ranking</CardTitle>
          </CardHeader>
          <CardContent>
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
                {ranking.map((user) => (
                  <TableRow key={user.position}>
                    <TableCell className="text-center">
                      {positionBadge(user.position)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar size="sm">
                          <AvatarFallback className="text-[10px] font-semibold">
                            {user.initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{user.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {user.score}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          parseInt(user.acerto) >= 85
                            ? "bg-emerald-100 text-emerald-700"
                            : parseInt(user.acerto) >= 80
                              ? "bg-blue-100 text-blue-700"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {user.acerto}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
