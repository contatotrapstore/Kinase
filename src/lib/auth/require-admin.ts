// ============================================================
// Auth helper — exige usuário Supabase Auth válido
// Usar em endpoints administrativos (gerenciar gabarito, editar
// questão, listar ranking com dados pessoais, etc.)
// ============================================================

import { createClient } from "@/lib/supabase/server";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Valida que existe um usuário autenticado na sessão Supabase.
 * Lança UnauthorizedError se não tiver — converter para 401 no handler.
 *
 * Para endpoints chamados pelo browser (UI admin), o cookie de sessão
 * é enviado automaticamente. Para chamadas de API externas, exigir
 * Authorization: Bearer <token>.
 */
export async function requireAdmin(): Promise<{ id: string; email: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    throw new UnauthorizedError(
      error?.message || "Sessão não encontrada — faça login no painel",
    );
  }
  return {
    id: data.user.id,
    email: data.user.email ?? "",
  };
}
