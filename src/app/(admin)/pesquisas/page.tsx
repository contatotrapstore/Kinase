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
import { ClipboardList } from "lucide-react";

interface Pesquisa {
  id: string;
  usuario: string;
  pacote: string;
  avaliacao: 1 | 2 | 3 | 4 | 5;
  feedback: string;
  data: string;
}

// Mock data — empty state
const mockPesquisas: Pesquisa[] = [];

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="text-sm">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < rating ? "text-amber-500" : "text-muted-foreground/30"}>
          ★
        </span>
      ))}
    </span>
  );
}

export default function PesquisasPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pesquisas</CardTitle>
        </CardHeader>
        <CardContent>
          {mockPesquisas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <ClipboardList className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                Nenhuma pesquisa respondida ainda
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                As pesquisas de satisfação aparecerão aqui quando os usuários responderem
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Pacote</TableHead>
                    <TableHead>Avaliação</TableHead>
                    <TableHead>Feedback</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockPesquisas.map((pesquisa) => (
                    <TableRow key={pesquisa.id}>
                      <TableCell className="font-medium">
                        {pesquisa.usuario}
                      </TableCell>
                      <TableCell>{pesquisa.pacote}</TableCell>
                      <TableCell>
                        <StarRating rating={pesquisa.avaliacao} />
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {pesquisa.feedback}
                      </TableCell>
                      <TableCell>{pesquisa.data}</TableCell>
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
