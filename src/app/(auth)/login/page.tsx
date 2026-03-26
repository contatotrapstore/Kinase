"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, ArrowLeft, Mail } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError("Email ou senha incorretos");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Email ou senha incorretos");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });

      if (error) {
        setError("Erro ao enviar email de recuperação. Tente novamente.");
        return;
      }

      setSuccess("Email de recuperação enviado! Verifique sua caixa de entrada.");
    } catch {
      setError("Erro ao enviar email de recuperação.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,oklch(0.97_0.014_172/30%),oklch(0.985_0.002_247),oklch(0.93_0.032_172/20%))] px-4">
      <div className="w-full max-w-sm">
        {/* Branding */}
        <div className="mb-8 flex flex-col items-center text-center">
          <img src="/logo-icon.svg" alt="Kinase" className="mb-3 h-12 w-12" />
          <h1 className="text-xl font-semibold text-foreground">Kinase</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Plataforma de Aprendizagem Médica
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center text-base">
              {forgotMode ? "Recuperar Senha" : "Entrar"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {forgotMode ? (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <p className="text-xs text-muted-foreground text-center">
                  Digite seu email e enviaremos um link para redefinir sua senha.
                </p>
                <div>
                  <Label htmlFor="reset-email" className="mb-2 block">
                    Email
                  </Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="seu@email.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-500">{error}</p>
                )}
                {success && (
                  <p className="text-sm text-emerald-600">{success}</p>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    "Enviando..."
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Enviar Link de Recuperação
                    </>
                  )}
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setForgotMode(false);
                    setError(null);
                    setSuccess(null);
                  }}
                  className="flex w-full items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Voltar ao login
                </button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="email" className="mb-2 block">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@exemplo.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="password" className="mb-2 block">
                    Senha
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-500">{error}</p>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    "Entrando..."
                  ) : (
                    <>
                      <LogIn className="mr-2 h-4 w-4" />
                      Entrar
                    </>
                  )}
                </Button>

                <p className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotMode(true);
                      setError(null);
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    Esqueceu a senha?
                  </button>
                </p>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          © 2026 Kinase
        </p>
      </div>
    </div>
  );
}
