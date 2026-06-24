"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileText,
  Loader2,
  Plus,
  Trash2,
  Pencil,
} from "lucide-react";

type Tipo = "pre" | "pos";
type Escala =
  | "1-5"
  | "sim_nao"
  | "texto"
  | "single_choice"
  | "multi_choice"
  | "numerico"
  | "top1"
  | "top3";

interface Opcao {
  id: string;
  label: string;
}

interface Pergunta {
  id: string;
  texto: string;
  escala: Escala;
  opcoes?: Opcao[];
  maxSelecoes?: number;
  min?: number;
  max?: number;
}

const escalasLabels: Record<Escala, string> = {
  "1-5": "Escala 1-5",
  sim_nao: "Sim / Não",
  texto: "Texto livre",
  single_choice: "Escolha única (opções)",
  multi_choice: "Múltipla escolha (opções)",
  numerico: "Número (livre / NPS)",
  top1: "Top-1 (escolha 1)",
  top3: "Top-3 (rankeie 3)",
};

const escalasComOpcoes: Escala[] = ["single_choice", "multi_choice", "top1", "top3"];

function newOpcaoId() {
  return `o_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
}

interface Formulario {
  id: string;
  tipo: Tipo;
  nome: string;
  perguntas: Pergunta[];
  ativo: boolean;
  trigger_apos_dias: number | null;
  trigger_apos_questoes: number | null;
  created_at: string;
}

interface FormularioComCount extends Formulario {
  respostas_count?: number;
}

const tipoConfig: Record<Tipo, { label: string; className: string }> = {
  pre: {
    label: "Pre-teste",
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  pos: {
    label: "Pos-teste",
    className: "bg-violet-100 text-violet-800 border-violet-200",
  },
};

function newPerguntaId() {
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const emptyFormulario = (): Formulario => ({
  id: "",
  tipo: "pre",
  nome: "",
  perguntas: [],
  ativo: true,
  trigger_apos_dias: null,
  trigger_apos_questoes: null,
  created_at: "",
});

function FormularioDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: Formulario | null;
  onSaved: () => void;
}) {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState<Formulario>(emptyFormulario());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setForm(initial ? { ...initial, perguntas: [...initial.perguntas] } : emptyFormulario());
    }
  }, [open, initial]);

  function updatePergunta(idx: number, patch: Partial<Pergunta>) {
    setForm((f) => ({
      ...f,
      perguntas: f.perguntas.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    }));
  }
  function addPergunta() {
    setForm((f) => ({
      ...f,
      perguntas: [...f.perguntas, { id: newPerguntaId(), texto: "", escala: "1-5" }],
    }));
  }
  function removePergunta(idx: number) {
    setForm((f) => ({
      ...f,
      perguntas: f.perguntas.filter((_, i) => i !== idx),
    }));
  }

  async function handleSubmit() {
    setError(null);

    if (!form.nome.trim()) {
      setError("Nome obrigatorio");
      return;
    }
    if (form.perguntas.length === 0) {
      setError("Adicione pelo menos uma pergunta");
      return;
    }
    if (form.perguntas.some((p) => !p.texto.trim())) {
      setError("Todas as perguntas precisam de texto");
      return;
    }
    for (const p of form.perguntas) {
      if (escalasComOpcoes.includes(p.escala)) {
        if (!p.opcoes || p.opcoes.length === 0) {
          setError(`Pergunta "${p.texto}" precisa de pelo menos 1 opção`);
          return;
        }
        if (p.opcoes.some((o) => !o.label.trim())) {
          setError(`Pergunta "${p.texto}" tem opção em branco`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      const payload = {
        tipo: form.tipo,
        nome: form.nome.trim(),
        perguntas: form.perguntas,
        ativo: form.ativo,
        trigger_apos_dias:
          form.tipo === "pos" ? form.trigger_apos_dias : null,
        trigger_apos_questoes:
          form.tipo === "pos" ? form.trigger_apos_questoes : null,
      };

      const url = isEdit ? `/api/formularios/${initial!.id}` : "/api/formularios";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Falha ao salvar");
      }
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      setError(err?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!isEdit || !initial) return;
    if (!confirm("Deletar formulario e todas as respostas?")) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/formularios/${initial.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Falha ao deletar");
      }
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      setError(err?.message ?? "Erro ao deletar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar formulario" : "Novo formulario"}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo</Label>
              <select
                id="tipo"
                value={form.tipo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tipo: e.target.value as Tipo }))
                }
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="pre">Pre-teste</option>
                <option value="pos">Pos-teste</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ativo">Status</Label>
              <label className="flex h-9 items-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm">
                <input
                  id="ativo"
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, ativo: e.target.checked }))
                  }
                  className="h-4 w-4"
                />
                <span>{form.ativo ? "Ativo" : "Inativo"}</span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input
              id="nome"
              value={form.nome}
              onChange={(e) =>
                setForm((f) => ({ ...f, nome: e.target.value }))
              }
              placeholder="Ex: Pesquisa de satisfacao inicial"
            />
          </div>

          {form.tipo === "pos" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dias">Trigger apos dias</Label>
                <Input
                  id="dias"
                  type="number"
                  min={0}
                  value={form.trigger_apos_dias ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      trigger_apos_dias: e.target.value
                        ? Number(e.target.value)
                        : null,
                    }))
                  }
                  placeholder="ex: 7"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="questoes">Trigger apos questoes</Label>
                <Input
                  id="questoes"
                  type="number"
                  min={0}
                  value={form.trigger_apos_questoes ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      trigger_apos_questoes: e.target.value
                        ? Number(e.target.value)
                        : null,
                    }))
                  }
                  placeholder="ex: 30"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Perguntas</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addPergunta}
              >
                <Plus className="mr-1 h-3 w-3" />
                Adicionar pergunta
              </Button>
            </div>

            {form.perguntas.length === 0 ? (
              <p className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
                Nenhuma pergunta. Clique em adicionar.
              </p>
            ) : (
              <div className="space-y-2">
                {form.perguntas.map((p, idx) => {
                  const comOpcoes = escalasComOpcoes.includes(p.escala);
                  return (
                    <div
                      key={p.id}
                      className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3"
                    >
                      <div className="flex items-start gap-2">
                        <span className="mt-2 text-xs font-medium text-muted-foreground">
                          {idx + 1}.
                        </span>
                        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                          <Input
                            value={p.texto}
                            onChange={(e) =>
                              updatePergunta(idx, { texto: e.target.value })
                            }
                            placeholder="Texto da pergunta"
                            className="flex-1"
                          />
                          <select
                            value={p.escala}
                            onChange={(e) => {
                              const novaEscala = e.target.value as Escala;
                              const precisaOpcoes = escalasComOpcoes.includes(novaEscala);
                              updatePergunta(idx, {
                                escala: novaEscala,
                                opcoes: precisaOpcoes
                                  ? p.opcoes ?? [{ id: newOpcaoId(), label: "" }]
                                  : undefined,
                                maxSelecoes: novaEscala === "multi_choice" ? p.maxSelecoes ?? 3 : undefined,
                                min: novaEscala === "numerico" ? p.min ?? 0 : undefined,
                                max: novaEscala === "numerico" ? p.max ?? 10 : undefined,
                              });
                            }}
                            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:w-48"
                          >
                            {(Object.keys(escalasLabels) as Escala[]).map((k) => (
                              <option key={k} value={k}>{escalasLabels[k]}</option>
                            ))}
                          </select>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removePergunta(idx)}
                          className="text-muted-foreground hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {p.escala === "multi_choice" && (
                        <div className="ml-6 flex items-center gap-2 text-xs">
                          <Label htmlFor={`max-${p.id}`}>Máximo seleções:</Label>
                          <Input
                            id={`max-${p.id}`}
                            type="number"
                            min={1}
                            value={p.maxSelecoes ?? ""}
                            onChange={(e) => updatePergunta(idx, { maxSelecoes: Number(e.target.value) || undefined })}
                            className="h-8 w-20"
                          />
                        </div>
                      )}

                      {p.escala === "numerico" && (
                        <div className="ml-6 flex items-center gap-2 text-xs">
                          <Label htmlFor={`min-${p.id}`}>Min:</Label>
                          <Input id={`min-${p.id}`} type="number" value={p.min ?? ""} onChange={(e) => updatePergunta(idx, { min: e.target.value === "" ? undefined : Number(e.target.value) })} className="h-8 w-20" />
                          <Label htmlFor={`max-${p.id}`}>Max:</Label>
                          <Input id={`max-${p.id}`} type="number" value={p.max ?? ""} onChange={(e) => updatePergunta(idx, { max: e.target.value === "" ? undefined : Number(e.target.value) })} className="h-8 w-20" />
                        </div>
                      )}

                      {comOpcoes && (
                        <div className="ml-6 space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Opções</Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                updatePergunta(idx, {
                                  opcoes: [...(p.opcoes ?? []), { id: newOpcaoId(), label: "" }],
                                })
                              }
                            >
                              <Plus className="mr-1 h-3 w-3" /> Opção
                            </Button>
                          </div>
                          <div className="space-y-1">
                            {(p.opcoes ?? []).map((o, oi) => (
                              <div key={o.id} className="flex gap-2">
                                <span className="mt-2 text-xs text-muted-foreground">{oi + 1})</span>
                                <Input
                                  value={o.label}
                                  onChange={(e) => {
                                    const novas = [...(p.opcoes ?? [])];
                                    novas[oi] = { ...o, label: e.target.value };
                                    updatePergunta(idx, { opcoes: novas });
                                  }}
                                  placeholder="Label da opção"
                                  className="h-8 flex-1"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() =>
                                    updatePergunta(idx, {
                                      opcoes: (p.opcoes ?? []).filter((_, i) => i !== oi),
                                    })
                                  }
                                  className="text-muted-foreground hover:text-red-600"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          {isEdit && (
            <Button
              type="button"
              variant="outline"
              onClick={handleDelete}
              disabled={saving}
              className="mr-auto text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Deletar
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function FormulariosPage() {
  const [formularios, setFormularios] = useState<FormularioComCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Formulario | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/formularios");
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Falha ao carregar");
      }
      const json = await res.json();
      const items: Formulario[] = json.formularios ?? [];

      // fetch count em paralelo
      const withCounts = await Promise.all(
        items.map(async (f) => {
          try {
            const r = await fetch(`/api/formularios/${f.id}`);
            if (!r.ok) return { ...f, respostas_count: 0 };
            const j = await r.json();
            return { ...f, respostas_count: j.respostas_count ?? 0 };
          } catch {
            return { ...f, respostas_count: 0 };
          }
        })
      );
      setFormularios(withCounts);
    } catch (err: any) {
      console.error("Erro ao carregar formularios:", err);
      setError(err?.message ?? "Erro ao carregar formularios");
      setFormularios([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleAtivo(f: FormularioComCount, ativo: boolean) {
    // Optimistic update
    setFormularios((prev) =>
      prev.map((x) => (x.id === f.id ? { ...x, ativo } : x))
    );
    try {
      const res = await fetch(`/api/formularios/${f.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo }),
      });
      if (!res.ok) throw new Error("Falha");
    } catch {
      // Revert
      setFormularios((prev) =>
        prev.map((x) => (x.id === f.id ? { ...x, ativo: !ativo } : x))
      );
    }
  }

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(f: Formulario) {
    setEditing(f);
    setDialogOpen(true);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Carregando formularios...
        </span>
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

      <div className="flex items-center justify-between">
        <div />
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          Novo formulario
        </Button>
      </div>

      {formularios.length === 0 ? (
        <Card>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                Nenhum formulario cadastrado
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Crie o primeiro formulario de pre ou pos-teste
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {formularios.map((f) => {
            const t = tipoConfig[f.tipo];
            return (
              <Card
                key={f.id}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => openEdit(f)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{f.nome}</CardTitle>
                    <Pencil className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={t.className}>
                      {t.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {f.perguntas.length} pergunta
                      {f.perguntas.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {f.respostas_count ?? 0} resposta
                      {(f.respostas_count ?? 0) === 1 ? "" : "s"}
                    </span>
                    <label
                      className="flex cursor-pointer items-center gap-2 text-xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={f.ativo}
                        onChange={(e) => toggleAtivo(f, e.target.checked)}
                        className="h-4 w-4"
                      />
                      <span>{f.ativo ? "Ativo" : "Inativo"}</span>
                    </label>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <FormularioDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSaved={load}
      />
    </div>
  );
}
