"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  BarChart3,
} from "lucide-react";

interface Question {
  number: number;
  text: string;
  options: { letter: string; text: string; isCorrect: boolean }[];
  explanation: string;
}

// Mock data for demonstration
const mockBank = {
  id: "1",
  nome: "Prova de Anatomia 2024.1",
  materia: "Anatomia",
  status: "pronto" as const,
  totalQuestions: 3,
};

const mockQuestions: Question[] = [
  {
    number: 1,
    text: "Qual é o maior osso do corpo humano?",
    options: [
      { letter: "A", text: "Tíbia", isCorrect: false },
      { letter: "B", text: "Fêmur", isCorrect: true },
      { letter: "C", text: "Úmero", isCorrect: false },
      { letter: "D", text: "Fíbula", isCorrect: false },
    ],
    explanation:
      "O fêmur é o maior e mais forte osso do corpo humano, localizado na coxa.",
  },
  {
    number: 2,
    text: "Quantos ossos possui o corpo humano adulto?",
    options: [
      { letter: "A", text: "196", isCorrect: false },
      { letter: "B", text: "206", isCorrect: true },
      { letter: "C", text: "216", isCorrect: false },
      { letter: "D", text: "256", isCorrect: false },
    ],
    explanation:
      "Um adulto possui 206 ossos. Bebês nascem com cerca de 270, que se fundem ao longo do crescimento.",
  },
  {
    number: 3,
    text: "Qual estrutura conecta o músculo ao osso?",
    options: [
      { letter: "A", text: "Ligamento", isCorrect: false },
      { letter: "B", text: "Cartilagem", isCorrect: false },
      { letter: "C", text: "Tendão", isCorrect: true },
      { letter: "D", text: "Fáscia", isCorrect: false },
    ],
    explanation:
      "Tendões conectam músculos aos ossos. Ligamentos conectam ossos a outros ossos.",
  },
];

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
              <span className="font-medium">Explicação: </span>
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
            {mockBank.nome}
          </h2>
          <Badge
            variant="outline"
            className="bg-emerald-100 text-emerald-800 border-emerald-200"
          >
            Pronto
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {mockBank.materia} &middot; {mockBank.totalQuestions} questões
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="questoes">
        <TabsList>
          <TabsTrigger value="questoes">Questões</TabsTrigger>
          <TabsTrigger value="estatisticas">Estatísticas</TabsTrigger>
        </TabsList>

        <TabsContent value="questoes" className="mt-4">
          <div className="space-y-3">
            {mockQuestions.map((q) => (
              <QuestionCard key={q.number} question={q} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="estatisticas" className="mt-4">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                Estatísticas não disponíveis
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                As estatísticas serão exibidas quando usuários responderem
                questões deste pacote
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
