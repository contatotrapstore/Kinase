// ============================================================
// Supabase Client — Service Role (bypass RLS)
// Use APENAS em rotas server-side onde o acesso é público ou
// já autenticado por outros mecanismos (webhook secret, API key).
// ============================================================

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase service client: faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient<Database>(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
