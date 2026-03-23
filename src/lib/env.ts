// ============================================================
// Configuração de variáveis de ambiente — Kinase MVP
// Todas opcionais com fallback para string vazia —
// o sistema funciona sem elas durante o desenvolvimento.
// ============================================================

export const env = {
  /** URL pública do projeto Supabase */
  NEXT_PUBLIC_SUPABASE_URL:
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',

  /** Chave anônima (pública) do Supabase */
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',

  /** Chave de serviço do Supabase (somente servidor) */
  SUPABASE_SERVICE_ROLE_KEY:
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',

  /** URL da API do WhatsApp (Evolution API, Z-API, etc.) */
  WHATSAPP_API_URL:
    process.env.WHATSAPP_API_URL ?? '',

  /** Token de autenticação da API do WhatsApp */
  WHATSAPP_API_TOKEN:
    process.env.WHATSAPP_API_TOKEN ?? '',

  /** ID da instância Z-API */
  ZAPI_INSTANCE_ID:
    process.env.ZAPI_INSTANCE_ID ?? '',

  /** Token da instância Z-API */
  ZAPI_TOKEN:
    process.env.ZAPI_TOKEN ?? '',

  /** Segredo para validação do webhook do WhatsApp */
  WHATSAPP_WEBHOOK_SECRET:
    process.env.WHATSAPP_WEBHOOK_SECRET ?? '',
} as const;
