// Implementação do WhatsAppAdapter usando Evolution API (REST)
// Docs: https://doc.evolution-api.com/

import type { WhatsAppAdapter, WhatsAppMessage } from "./adapter";

interface EvolutionConfig {
  apiUrl: string;
  apiKey: string;
  instanceName: string;
}

export class EvolutionWhatsAppAdapter implements WhatsAppAdapter {
  private apiUrl: string;
  private apiKey: string;
  private instanceName: string;
  private messageHandler: ((message: WhatsAppMessage) => Promise<void>) | null = null;

  constructor(config: EvolutionConfig) {
    // Remove trailing slash da URL base
    this.apiUrl = config.apiUrl.replace(/\/+$/, "");
    this.apiKey = config.apiKey;
    this.instanceName = config.instanceName;
  }

  private async request(path: string, body: unknown): Promise<Response> {
    const url = `${this.apiUrl}${path}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "unknown error");
      throw new Error(
        `Evolution API error [${response.status}] on ${path}: ${errorText}`
      );
    }

    return response;
  }

  async sendText(to: string, message: string): Promise<void> {
    // TODO: verificar formato exato do payload na versão da Evolution API em uso
    await this.request(`/message/sendText/${this.instanceName}`, {
      number: to,
      text: message,
    });
  }

  async sendImage(to: string, imageUrl: string, caption?: string): Promise<void> {
    // TODO: verificar se o campo é "mediaUrl" ou "media" dependendo da versão
    await this.request(`/message/sendMedia/${this.instanceName}`, {
      number: to,
      mediatype: "image",
      media: imageUrl,
      caption: caption ?? "",
    });
  }

  async sendButtons(
    to: string,
    text: string,
    buttons: { id: string; title: string }[]
  ): Promise<void> {
    // TODO: formato de botões pode variar — verificar documentação da versão instalada
    // Nota: WhatsApp tem limitado suporte a botões interativos em algumas regiões
    await this.request(`/message/sendButtons/${this.instanceName}`, {
      number: to,
      title: "Opções",
      description: text,
      buttons: buttons.map((b) => ({
        buttonId: b.id,
        buttonText: { displayText: b.title },
        type: 1,
      })),
    });
  }

  onMessage(handler: (message: WhatsAppMessage) => Promise<void>): void {
    this.messageHandler = handler;
  }

  parseWebhook(body: unknown): WhatsAppMessage | null {
    try {
      const data = body as Record<string, unknown>;

      // TODO: verificar estrutura exata do webhook da Evolution API
      // O formato abaixo é baseado na documentação padrão — pode variar com versão/config
      const eventData = (data.data ?? data) as Record<string, unknown>;
      const key = eventData.key as Record<string, unknown> | undefined;
      const messageContent = eventData.message as Record<string, unknown> | undefined;

      if (!key || !messageContent) return null;

      const from = (key.remoteJid as string)?.replace(/@s\.whatsapp\.net$/, "");
      if (!from) return null;

      const text =
        (messageContent.conversation as string) ??
        (messageContent.extendedTextMessage as Record<string, unknown>)?.text as string ??
        undefined;

      const mediaUrl =
        (messageContent.imageMessage as Record<string, unknown>)?.url as string ??
        undefined;

      const timestamp = eventData.messageTimestamp
        ? new Date(Number(eventData.messageTimestamp) * 1000)
        : new Date();

      const message: WhatsAppMessage = { from, text, mediaUrl, timestamp };

      // Dispara o handler registrado, se existir
      if (this.messageHandler) {
        void this.messageHandler(message);
      }

      return message;
    } catch {
      return null;
    }
  }
}
