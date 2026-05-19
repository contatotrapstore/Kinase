"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { User, Lock, Mail, Calendar, Users, Plus, Loader2 } from "lucide-react";

export default function PerfilPage() {
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [loading, setLoading] = useState(true);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  type AdminEntry = {
    id: string;
    email: string;
    name: string | null;
    created_at: string;
    last_sign_in_at: string | null;
  };
  const [admins, setAdmins] = useState<AdminEntry[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [adminMessage, setAdminMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function refreshAdmins() {
    setLoadingAdmins(true);
    try {
      const res = await fetch("/api/admins");
      if (res.ok) {
        const json = await res.json();
        setAdmins(json.admins ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoadingAdmins(false);
    }
  }

  useEffect(() => {
    refreshAdmins();
  }, []);

  async function handleCreateAdmin(e: React.FormEvent) {
    e.preventDefault();
    setAdminMessage(null);
    if (newAdminPassword.length < 6) {
      setAdminMessage({ type: "error", text: "Senha precisa ter pelo menos 6 caracteres." });
      return;
    }
    setCreatingAdmin(true);
    try {
      const res = await fetch("/api/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, password: newAdminPassword, name: newName || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAdminMessage({ type: "error", text: json.error ?? "Erro ao criar administrador" });
      } else {
        setAdminMessage({ type: "success", text: `Administrador ${newEmail} criado!` });
        setNewEmail("");
        setNewAdminPassword("");
        setNewName("");
        refreshAdmins();
      }
    } catch (err) {
      setAdminMessage({ type: "error", text: err instanceof Error ? err.message : "Erro de rede" });
    } finally {
      setCreatingAdmin(false);
    }
  }

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email ?? "");
        setName(
          user.user_metadata?.full_name ??
            user.user_metadata?.name ??
            ""
        );
        setCreatedAt(
          new Date(user.created_at).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })
        );
      }
      setLoading(false);
    };
    fetchUser();
  }, [supabase]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword.length < 6) {
      setMessage({
        type: "error",
        text: "A senha deve ter pelo menos 6 caracteres.",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({
        type: "error",
        text: "As senhas não coincidem.",
      });
      return;
    }

    try {
      setChangingPassword(true);
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setMessage({ type: "error", text: error.message });
      } else {
        setMessage({
          type: "success",
          text: "Senha alterada com sucesso!",
        });
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setMessage({
        type: "error",
        text: "Erro inesperado ao alterar a senha.",
      });
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* User info card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Informações do Perfil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                E-mail
              </Label>
              <p className="text-sm font-medium">{email || "—"}</p>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                Nome
              </Label>
              <p className="text-sm font-medium">{name || "—"}</p>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                Conta criada em
              </Label>
              <p className="text-sm font-medium">{createdAt || "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change password card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Alterar Senha
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova senha</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar nova senha</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Repita a nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            {message && (
              <p
                className={`text-sm ${
                  message.type === "success"
                    ? "text-green-600"
                    : "text-destructive"
                }`}
              >
                {message.text}
              </p>
            )}

            <Button type="submit" disabled={changingPassword}>
              {changingPassword ? "Alterando..." : "Alterar Senha"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Manage other admins */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Outros Administradores
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Lista atual */}
          <div className="space-y-2">
            <Label className="text-muted-foreground">Administradores ativos</Label>
            {loadingAdmins ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </div>
            ) : admins.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum administrador cadastrado.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {admins.map((a) => (
                  <li key={a.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium">{a.name ?? a.email}</p>
                      <p className="text-xs text-muted-foreground">{a.email}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {a.last_sign_in_at
                        ? `Último acesso: ${new Date(a.last_sign_in_at).toLocaleDateString("pt-BR")}`
                        : "Nunca acessou"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Form criar */}
          <form onSubmit={handleCreateAdmin} className="space-y-4 max-w-md border-t pt-6">
            <div className="space-y-2">
              <Label htmlFor="new-admin-name">Nome (opcional)</Label>
              <Input
                id="new-admin-name"
                placeholder="Ex: Dr. Eduardo"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-admin-email">E-mail</Label>
              <Input
                id="new-admin-email"
                type="email"
                placeholder="email@dominio.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-admin-password">Senha inicial</Label>
              <Input
                id="new-admin-password"
                type="password"
                placeholder="Mínimo 6 caracteres (passe pro novo admin)"
                value={newAdminPassword}
                onChange={(e) => setNewAdminPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            {adminMessage && (
              <p className={`text-sm ${adminMessage.type === "success" ? "text-green-600" : "text-destructive"}`}>
                {adminMessage.text}
              </p>
            )}

            <Button type="submit" disabled={creatingAdmin} className="gap-2">
              {creatingAdmin ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {creatingAdmin ? "Criando..." : "Adicionar Administrador"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
