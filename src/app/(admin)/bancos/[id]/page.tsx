"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  BarChart3,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface QuestionOption {
  letter: string;
  text: string;
  isCorrect: boolean;
}

interface Question {
  number: number;
  text: string;
  options: QuestionOption[];
  explanation: string;
}

interface BankData {
  id: string;
  nome: string;
  materia: string;
  status: string;
  totalQuestions: number;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-amber-100 text-amber-800 border-amber-200" },
  processing: { label: "Processando", className: "bg-blue-100 text-blue-800 border-blue-200" },
  ready: { label: "Pronto", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  error: { label: "Erro", className: "bg-red-100 text-red-800 border-red-200" },
};

function QuestionCard({ question }: { question: Question }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-border">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {question.number}
          </span>
          <span className="text-sm font-medium text-foreground line-clamp-1">
            {question.text}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          <p className="mb-3 text-sm text-foreground">{question.text}</p>

          <div className="space-y-2">
            {question.options.map((option) => (
              <div
                key={option.letter}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                  option.isCorrect
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-muted/50 text-foreground"
                }`}
              >
                {option.isCorrect ? (
                  <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                )}
                <span className="font-medium">{option.letter})</span>
                <span>{option.text}</span>
              </div>
            ))}
          </div>

          {question.explanation && (
            <div className="mt-3 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
              <span className="font-medium">Explicacao: </span>
              {question.explanation}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function BankDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const supabase = useMemo(() => createClient(), []);

  const [bank, setBank] = useState<BankData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // Buscar pacote com area
        const { data: pacote, error: pacoteError } = await supabase
          .from("pacotes")
          .select("*, areas_conhecimento(name)")
          .eq("id", id)
          .single() as { data: any; error: any };

        if (pacoteError || !pacote) {
          setError("Pacote nao encontrado");
          setLoading(false);
          return;
        }

        setBank({
          id: pacote.id,
          nome: pacote.name,
          materia: pacote.areas_conhecimento?.name ?? "",
          status: pacote.status,
          totalQuestions: pacote.total_questions,
        });

        // Buscar questoes com opcoes
        const { data: questoes, error: questoesError } = await supabase
          .from("questoes")
          .select("*, opcoes(*)")
          .eq("pacote_id", id)
          .order("question_order", { ascending: true }) as { data: any[]; error: any };

        if (questoesError) {
          console.error("Erro ao buscar questoes:", questoesError);
          setError("Erro ao carregar questoes");
          setLoading(false);
          return;
        }

        const mapped: Question[] = (questoes ?? []).map((q: any) => ({
          number: q.question_order,
          text: q.text,
          options: (q.opcoes ?? [])
            .sort((a: any, b: any) => a.label.localeCompare(b.label))
            .map((o: any) => ({
              letter: o.label,
              text: o.text,
              isCorrect: o.is_correct,
            })),
          explanation: q.explanation ?? "",
        }));

        setQuestions(mapped);
      } catch (err) {
        console.error("Erro ao carregar pacote:", err);
        setError("Erro ao carregar dados do pacote");
      } finally {
        setLoading(false);
      }
    }

    if (id) fetchData();
  }, [id, supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Carregando pacote...</span>
      </div>
    );
  }

  if (error || !bank) {
    return (
      <div className="space-y-4">
        <Link
          href="/bancos"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Pacotes
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error || "Pacote nao encontrado"}
        </div>
      </div>
    );
  }

  const status = statusConfig[bank.status] ?? statusConfig.pending;

  return (
    <div className="space-y-6">
      {/* Back link & header */}
      <div>
        <Link
          href="/bancos"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Pacotes
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold text-foreground">
            {bank.nome}
          </h2>
          <Badge variant="outline" className={status.className}>
            {status.label}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {bank.materia} &middot; {bank.totalQuestions} questoes
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="questoes">
        <TabsList>
          <TabsTrigger value="questoes">Questoes</TabsTrigger>
          <TabsTrigger value="estatisticas">Estatisticas</TabsTrigger>
        </TabsList>

        <TabsContent value="questoes" className="mt-4">
          {questions.length === 0 ? (
            <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
              Nenhuma questao encontrada neste pacote.
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((q) => (
                <QuestionCard key={q.number} question={q} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="estatisticas" className="mt-4">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                Estatisticas nao disponiveis
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                As estatisticas serao exibidas quando usuarios responderem
                questoes deste pacote
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
