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

  // getSession() é determinístico: verifica se há cookie de sessão válido
  // (não faz round-trip ao Supabase Auth como getUser faria)
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) {
    throw new UnauthorizedError(error.message || "Erro ao validar sessão");
  }
  if (!session?.user) {
    throw new UnauthorizedError(
      "Sessão não encontrada — faça login no painel admin",
    );
  }

  return {
    id: session.user.id,
    email: session.user.email ?? "",
  };
}
