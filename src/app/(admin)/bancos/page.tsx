"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BookOpen, Plus, Eye } from "lucide-react";

type BankStatus = "pendente" | "processando" | "pronto" | "erro";

interface QuestionBank {
  id: string;
  nome: string;
  materia: string;
  questoes: number;
  tamanho: 10 | 20 | 30;
  status: BankStatus;
  data: string;
}

const statusConfig: Record<
  BankStatus,
  { label: string; className: string }
> = {
  pendente: {
    label: "Pendente",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  processando: {
    label: "Processando",
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  pronto: {
    label: "Pronto",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  erro: {
    label: "Erro",
    className: "bg-red-100 text-red-800 border-red-200",
  },
};

// Mock data — empty state
const mockBanks: QuestionBank[] = [];

export default function BancosPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div />
        <Link href="/upload">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Novo Pacote
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pacotes</CardTitle>
        </CardHeader>
        <CardContent>
          {mockBanks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <BookOpen className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                Nenhum pacote cadastrado
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Faça upload de um PDF para criar seu primeiro pacote
              </p>
              <Link href="/upload" className="mt-4">
                <Button variant="outline" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Upload PDF
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Matéria</TableHead>
                    <TableHead className="text-center">Questões</TableHead>
                    <TableHead className="text-center">Tamanho</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockBanks.map((bank) => {
                    const status = statusConfig[bank.status];
                    return (
                      <TableRow key={bank.id}>
                        <TableCell className="font-medium">
                          {bank.nome}
                        </TableCell>
                        <TableCell>{bank.materia}</TableCell>
                        <TableCell className="text-center">
                          {bank.questoes}
                        </TableCell>
                        <TableCell className="text-center">
                          {bank.tamanho}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={status.className}
                          >
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell>{bank.data}</TableCell>
                        <TableCell className="text-right">
                          <Link href={`/bancos/${bank.id}`}>
                            <Button variant="ghost" size="icon-sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
