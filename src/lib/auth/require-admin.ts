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
 * Valida que existe uma sessão Supabase Auth ativa.
 * Lança UnauthorizedError se não tiver — converter para 401 no handler.
 *
 * Para endpoints chamados pelo browser (UI admin), o cookie de sessão
 * é enviado automaticamente. Curl sem cookies = 401.
 */
export async function requireAdmin(): Promise<{ id: string; email: string }> {
  const supabase = await createClient();

  // getUser faz validação contra Supabase Auth — mais seguro que getSession
  // Sem cookies, retorna user=null + erro
  const { data: { user }, error } = await supabase.auth.getUser();

  console.log("[requireAdmin]", {
    hasUser: !!user,
    userEmail: user?.email,
    errorMsg: error?.message,
  });

  if (error || !user) {
    throw new UnauthorizedError(
      error?.message || "Sessão não encontrada — faça login no painel admin",
    );
  }

  return {
    id: user.id,
    email: user.email ?? "",
  };
}
