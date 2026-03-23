// Implementação do WhatsAppAdapter usando Z-API
// Docs: https://developer.z-api.io/

import type { WhatsAppAdapter, WhatsAppMessage } from "./adapter";

interface ZApiConfig {
  instanceId: string;
  token: string;
  securityToken: string;
}

export class ZApiWhatsAppAdapter implements WhatsAppAdapter {
  private baseUrl: string;
  private securityToken: string;
  private messageHandler: ((message: WhatsAppMessage) => Promise<void>) | null = null;

  constructor(config: ZApiConfig) {
    this.baseUrl = `https://api.z-api.io/instances/${config.instanceId}/token/${config.token}`;
    this.securityToken = config.securityToken;
  }

  private async request(path: string, body: unknown): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": this.securityToken,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "unknown error");
      throw new Error(
        `Z-API error [${response.status}] on ${path}: ${errorText}`
      );
    }

    return response;
  }

  async sendText(to: string, message: string): Promise<void> {
    await this.request("/send-text", {
      phone: to,
      message,
    });
  }

  async sendImage(to: string, imageUrl: string, caption?: string): Promise<void> {
    await this.request("/send-image", {
      phone: to,
      image: imageUrl,
      caption: caption ?? "",
    });
  }

  async sendButtons(
    to: string,
    text: string,
    buttons: { id: string; title: string }[]
  ): Promise<void> {
    await this.request("/send-button-list", {
      phone: to,
      message: text,
      buttonList: {
        buttons: buttons.map((b) => ({
          id: b.id,
          label: b.title,
        })),
      },
    });
  }

  onMessage(handler: (message: WhatsAppMessage) => Promise<void>): void {
    this.messageHandler = handler;
  }

  parseWebhook(body: unknown): WhatsAppMessage | null {
    try {
      const data = body as Record<string, unknown>;

      // Z-API envia o campo "phone" com o número do remetente
      const from = data.phone as string | undefined;
      if (!from) return null;

      // Texto pode vir em "text" ou "message" dependendo do tipo de evento
      const text = (data.text as Record<string, unknown>)?.message as string
        ?? data.text as string
        ?? undefined;

      const mediaUrl = data.image as string
        ?? (data.photo as Record<string, unknown>)?.imageUrl as string
        ?? undefined;

      const timestamp = data.momment
        ? new Date(Number(data.momment))  // Z-API usa "momment" (com dois m's)
        : new Date();

      const message: WhatsAppMessage = { from, text, mediaUrl, timestamp };

      if (this.messageHandler) {
        void this.messageHandler(message);
      }

      return message;
    } catch {
      return null;
    }
  }
}
