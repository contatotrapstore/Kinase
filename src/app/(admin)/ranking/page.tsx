"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trophy } from "lucide-react";

interface RankEntry {
  posicao: number;
  nome: string;
  pontuacao: number;
  acertos: number;
  total: number;
  percentual: string;
}

const mockBankOptions = [
  { value: "", label: "Todos os bancos" },
  { value: "1", label: "Prova de Anatomia 2024.1" },
  { value: "2", label: "Farmacologia - Módulo 1" },
];

// Mock data — empty state
const mockRanking: RankEntry[] = [];

const positionBadge = (pos: number) => {
  if (pos === 1)
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
        1&ordm;
      </span>
    );
  if (pos === 2)
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 text-xs font-bold text-zinc-600">
        2&ordm;
      </span>
    );
  if (pos === 3)
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">
        3&ordm;
      </span>
    );
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center text-sm text-muted-foreground">
      {pos}&ordm;
    </span>
  );
};

export default function RankingPage() {
  const [bankFilter, setBankFilter] = useState("");

  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="max-w-xs">
        <select
          value={bankFilter}
          onChange={(e) => setBankFilter(e.target.value)}
          className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {mockBankOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ranking</CardTitle>
        </CardHeader>
        <CardContent>
          {mockRanking.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Trophy className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                Nenhum dado no ranking
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                O ranking será preenchido quando alunos responderem questões
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Posição</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead className="text-center">Pontuação</TableHead>
                    <TableHead className="text-center">Acertos</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">% Acerto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockRanking.map((entry) => (
                    <TableRow
                      key={entry.posicao}
                      className={
                        entry.posicao <= 3 ? "bg-muted/30" : undefined
                      }
                    >
                      <TableCell>{positionBadge(entry.posicao)}</TableCell>
                      <TableCell className="font-medium">
                        {entry.nome}
                      </TableCell>
                      <TableCell className="text-center">
                        {entry.pontuacao}
                      </TableCell>
                      <TableCell className="text-center">
                        {entry.acertos}
                      </TableCell>
                      <TableCell className="text-center">
                        {entry.total}
                      </TableCell>
                      <TableCell className="text-center">
                        {entry.percentual}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
