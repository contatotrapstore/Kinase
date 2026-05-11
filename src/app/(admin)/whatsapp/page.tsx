"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Smartphone,
  RefreshCw,
} from "lucide-react";

interface BotStatus {
  connected: boolean;
  qrBase64?: string;
  error?: string;
  paymentStatus?: string;
}

export default function WhatsAppPage() {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchStatus(showLoader = false) {
    if (showLoader) setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/qr");
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        setStatus({
          connected: false,
          error: errBody.error ?? `HTTP ${res.status}`,
        });
      } else {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err) {
      setStatus({
        connected: false,
        error: err instanceof Error ? err.message : "erro desconhecido",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStatus(true);
    // Auto-refresh a cada 4s — assim que escanear o QR, página detecta conexão
    intervalRef.current = setInterval(() => fetchStatus(false), 4000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (loading && !status) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">
          Verificando status do bot...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Conexão WhatsApp
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Status da conexão entre o bot Kinase e o WhatsApp do número dedicado
        </p>
      </div>

      {status?.connected ? (
        // ===== CONECTADO =====
        <Card className="border-emerald-200">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-emerald-700">
                Bot conectado e funcionando
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                O bot está pronto para receber e responder mensagens dos médicos
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchStatus(true)}
              className="gap-2"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Atualizar status
            </Button>
          </CardContent>
        </Card>
      ) : status?.qrBase64 ? (
        // ===== DESCONECTADO COM QR =====
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-5 w-5" />
                Bot desconectado
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <img
                src={status.qrBase64}
                alt="QR Code para conectar WhatsApp"
                className="h-64 w-64 rounded-lg border border-border"
              />
              <p className="text-center text-xs text-muted-foreground">
                Escaneie este QR com o WhatsApp do número que será o bot.
                A página detecta a conexão automaticamente.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchStatus(true)}
                className="gap-2"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Gerar novo QR
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Como conectar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="font-semibold text-foreground">
                  1. Pegue o celular do bot
                </p>
                <p className="text-muted-foreground">
                  O celular com o número que vai ser usado pelo bot Kinase
                  (não pode ser seu pessoal).
                </p>
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  2. Abra o WhatsApp desse celular
                </p>
                <p className="text-muted-foreground">
                  Toque nos 3 pontinhos no canto superior direito.
                </p>
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  3. Vá em &quot;Aparelhos conectados&quot;
                </p>
                <p className="text-muted-foreground">
                  Depois toque em &quot;Conectar um aparelho&quot;.
                </p>
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  4. Aponte a câmera pro QR ao lado
                </p>
                <p className="text-muted-foreground">
                  Em 1-2 segundos a página vai mudar pra verde
                  (bot conectado).
                </p>
              </div>
              <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                <strong>Importante:</strong> mantenha esse celular sempre
                ligado e com WhatsApp aberto. Se desconectar (chip trocado,
                celular reiniciado, etc.), volta aqui e escaneia de novo.
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        // ===== ERRO =====
        <Card className="border-red-200">
          <CardContent className="py-8 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-red-500" />
            <p className="mt-3 text-sm font-medium text-red-700">
              Não foi possível obter o status do bot
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {status?.error ?? "Erro desconhecido"}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchStatus(true)}
              className="mt-4 gap-2"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
