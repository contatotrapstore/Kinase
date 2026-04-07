"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, Search, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type UserStatus = "ativo" | "inativo";

interface Usuario {
  id: string;
  nome: string;
  telefone: string;
  status: UserStatus;
  registradoEm: string;
  progresso: string;
}

const statusConfig: Record<UserStatus, { label: string; className: string }> =
  {
    ativo: {
      label: "Ativo",
      className: "bg-emerald-100 text-emerald-800 border-emerald-200",
    },
    inativo: {
      label: "Inativo",
      className: "bg-zinc-100 text-zinc-600 border-zinc-200",
    },
  };

export default function AlunosPage() {
  const [search, setSearch] = useState("");
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUsuarios() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('usuarios')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Erro ao buscar usuários:', error);
          setError('Erro ao carregar usuarios. Verifique sua conexao.');
          setUsuarios([]);
          return;
        }

        const mapped: Usuario[] = (data ?? []).map((u: any) => ({
          id: u.id,
          nome: u.name ?? u.nome ?? '',
          telefone: u.phone ?? u.telefone ?? '',
          status: u.status ?? 'ativo',
          registradoEm: u.created_at
            ? new Date(u.created_at).toLocaleDateString('pt-BR')
            : '',
          progresso: u.progress ?? u.progresso ?? '—',
        }));

        setUsuarios(mapped);
      } catch (err) {
        console.error('Erro ao buscar usuários:', err);
        setError('Erro ao carregar usuarios. Verifique sua conexao.');
        setUsuarios([]);
      } finally {
        setLoading(false);
      }
    }

    fetchUsuarios();
  }, []);

  const filtered = usuarios.filter(
    (s) =>
      s.nome.toLowerCase().includes(search.toLowerCase()) ||
      s.telefone.includes(search)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Carregando usuários...</span>
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
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usuários</CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 && usuarios.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                Nenhum médico cadastrado ainda
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Os usuários aparecerão aqui quando se cadastrarem via WhatsApp
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Registrado em</TableHead>
                    <TableHead>Progresso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((usuario) => {
                    const status = statusConfig[usuario.status];
                    return (
                      <TableRow key={usuario.id}>
                        <TableCell className="font-medium">
                          {usuario.nome}
                        </TableCell>
                        <TableCell>{usuario.telefone}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={status.className}
                          >
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell>{usuario.registradoEm}</TableCell>
                        <TableCell>{usuario.progresso}</TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && usuarios.length > 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        Nenhum usuário encontrado para &ldquo;{search}&rdquo;
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
