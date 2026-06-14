"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, Search, Loader2, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type UserStatus = "ativo" | "inativo";

interface Usuario {
  id: string;
  nome: string;
  telefone: string;
  status: UserStatus;
  registradoEm: string;
  progresso: string;
  grupo: string | null;
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

type BadgeVariant = "default" | "secondary" | "outline";

function grupoBadgeVariant(grupo: string | null): BadgeVariant {
  if (!grupo) return "outline";
  const g = grupo.toLowerCase();
  if (g === "controle") return "secondary";
  if (g === "teste") return "default";
  return "outline";
}

const GRUPO_PRESETS = ["controle", "teste"] as const;
const SEM_GRUPO = "__none__";
const OUTRO = "__other__";

export default function AlunosPage() {
  const [search, setSearch] = useState("");
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Usuario | null>(null);
  const [selection, setSelection] = useState<string>(SEM_GRUPO);
  const [outroValor, setOutroValor] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
        status: u.status ?? (u.active === false ? 'inativo' : 'ativo'),
        registradoEm: u.created_at
          ? new Date(u.created_at).toLocaleDateString('pt-BR')
          : '',
        progresso: u.progress ?? u.progresso ?? '—',
        grupo: u.grupo_experimental ?? null,
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

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const filtered = usuarios.filter(
    (s) =>
      s.nome.toLowerCase().includes(search.toLowerCase()) ||
      s.telefone.includes(search)
  );

  function openEdit(u: Usuario) {
    setEditing(u);
    setSaveError(null);
    if (!u.grupo) {
      setSelection(SEM_GRUPO);
      setOutroValor("");
    } else if ((GRUPO_PRESETS as readonly string[]).includes(u.grupo.toLowerCase())) {
      setSelection(u.grupo.toLowerCase());
      setOutroValor("");
    } else {
      setSelection(OUTRO);
      setOutroValor(u.grupo);
    }
  }

  function closeEdit() {
    if (saving) return;
    setEditing(null);
    setSaveError(null);
  }

  async function handleSave() {
    if (!editing) return;
    let grupo: string | null;
    if (selection === SEM_GRUPO) grupo = null;
    else if (selection === OUTRO) {
      const trimmed = outroValor.trim();
      if (!trimmed) {
        setSaveError("Informe o nome do grupo personalizado.");
        return;
      }
      grupo = trimmed;
    } else {
      grupo = selection;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/alunos/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grupo }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data?.error ?? `Erro ${res.status}`);
        return;
      }
      setEditing(null);
      await fetchUsuarios();
    } catch (err) {
      console.error("[alunos] erro ao salvar grupo:", err);
      setSaveError("Falha de rede ao salvar.");
    } finally {
      setSaving(false);
    }
  }

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
                    <TableHead>Grupo</TableHead>
                    <TableHead>Registrado em</TableHead>
                    <TableHead>Progresso</TableHead>
                    <TableHead className="w-[80px] text-right">Ações</TableHead>
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
                        <TableCell>
                          <Badge variant={grupoBadgeVariant(usuario.grupo)}>
                            {usuario.grupo ?? "sem grupo"}
                          </Badge>
                        </TableCell>
                        <TableCell>{usuario.registradoEm}</TableCell>
                        <TableCell>{usuario.progresso}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Editar grupo de ${usuario.nome}`}
                            onClick={() => openEdit(usuario)}
                          >
                            <Pencil />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && usuarios.length > 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
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

      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) closeEdit(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar grupo experimental</DialogTitle>
            <DialogDescription>
              {editing ? `Usuário: ${editing.nome || editing.telefone}` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="grupo-select">Grupo</Label>
              <select
                id="grupo-select"
                value={selection}
                onChange={(e) => setSelection(e.target.value)}
                disabled={saving}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="controle">controle</option>
                <option value="teste">teste</option>
                <option value={SEM_GRUPO}>(sem grupo)</option>
                <option value={OUTRO}>outro...</option>
              </select>
            </div>

            {selection === OUTRO && (
              <div className="grid gap-1.5">
                <Label htmlFor="grupo-outro">Nome do grupo</Label>
                <Input
                  id="grupo-outro"
                  value={outroValor}
                  onChange={(e) => setOutroValor(e.target.value)}
                  placeholder="ex: piloto, beta"
                  disabled={saving}
                />
              </div>
            )}

            {saveError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                {saveError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeEdit} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
