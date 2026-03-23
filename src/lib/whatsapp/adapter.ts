// Interface base para adaptadores de WhatsApp
// Permite trocar entre Evolution API, Z-API, ou outros provedores

export interface WhatsAppMessage {
  from: string;        // phone number
  text?: string;
  mediaUrl?: string;
  timestamp: Date;
}

export interface WhatsAppAdapter {
  sendText(to: string, message: string): Promise<void>;
  sendImage(to: string, imageUrl: string, caption?: string): Promise<void>;
  sendButtons(to: string, text: string, buttons: { id: string; title: string }[]): Promise<void>;
  onMessage(handler: (message: WhatsAppMessage) => Promise<void>): void;
  parseWebhook(body: unknown): WhatsAppMessage | null;
}
