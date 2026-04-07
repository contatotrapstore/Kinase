"use client";

import { useState, useEffect } from "react";
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
import { Trophy, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface RankEntry {
  posicao: number;
  nome: string;
  pontuacao: number;
  acertos: number;
  total: number;
  percentual: string;
}

interface BankOption {
  value: string;
  label: string;
}

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
  const [ranking, setRanking] = useState<RankEntry[]>([]);
  const [bankOptions, setBankOptions] = useState<BankOption[]>([
    { value: "", label: "Todos os bancos" },
  ]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = createClient();

        // Fetch pacotes for filter options
        const { data: pacotes, error: pacotesError } = await supabase
          .from('pacotes')
          .select('id, name')
          .order('name');

        if (!pacotesError && pacotes) {
          setBankOptions([
            { value: "", label: "Todos os bancos" },
            ...pacotes.map((p: any) => ({
              value: p.id,
              label: p.name ?? '',
            })),
          ]);
        }

        // Fetch rankings
        const { data, error } = await supabase
          .from('rankings')
          .select('*, usuarios(name, phone), pacotes(name)')
          .order('total_score', { ascending: false });

        if (error) {
          console.error('Erro ao buscar ranking:', error);
          setError('Erro ao carregar ranking. Verifique sua conexao.');
          setRanking([]);
          return;
        }

        const mapped: RankEntry[] = (data ?? []).map((r: any, index: number) => ({
          posicao: index + 1,
          nome: r.usuarios?.name ?? '',
          pontuacao: r.total_score ?? 0,
          acertos: r.correct_answers ?? 0,
          total: r.total_answers ?? 0,
          percentual:
            r.total_answers && r.total_answers > 0
              ? `${Math.round((r.correct_answers / r.total_answers) * 100)}%`
              : '0%',
        }));

        setRanking(mapped);
      } catch (err) {
        console.error('Erro ao buscar ranking:', err);
        setError('Erro ao carregar ranking. Verifique sua conexao.');
        setRanking([]);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Carregando ranking...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {/* Filter */}
      <div className="max-w-xs">
        <select
          value={bankFilter}
          onChange={(e) => setBankFilter(e.target.value)}
          className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {bankOptions.map((opt) => (
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
          {ranking.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Trophy className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                Nenhum dado no ranking
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                O ranking será preenchido quando usuários responderem questões
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
                  {ranking.map((entry) => (
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
