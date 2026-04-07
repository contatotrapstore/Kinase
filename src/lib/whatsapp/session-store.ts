import { createClient } from "@/lib/supabase/server";

export interface SessionData {
  userId: string;
  pacoteId: string;
  currentBlock: number;
  currentQuestionIndex: number;
  score: number;
  errorsInBlock: number;
  retryQueue: string[];
  totalCorrect: number;
  totalAnswered: number;
}

/**
 * Persists session progress to progresso_usuario via UPSERT.
 */
export async function saveSession(
  userId: string,
  pacoteId: string,
  data: SessionData
): Promise<void> {
  const supabase = (await createClient()) as any;

  const { error } = await supabase.from("progresso_usuario").upsert(
    {
      usuario_id: userId,
      pacote_id: pacoteId,
      current_block: data.currentBlock,
      current_question_index: data.currentQuestionIndex,
      score: data.score,
      errors_in_block: data.errorsInBlock,
      retry_queue: data.retryQueue,
      total_correct: data.totalCorrect,
      total_answered: data.totalAnswered,
      status: "in_progress",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "usuario_id,pacote_id" }
  );

  if (error) {
    console.error("[session-store] Erro ao salvar sessão:", error);
  }
}

/**
 * Loads the most recent in-progress session for a user.
 * Returns null if no active session exists.
 */
export async function loadSession(
  userId: string
): Promise<(SessionData & { pacoteId: string }) | null> {
  const supabase = (await createClient()) as any;

  const { data, error } = await supabase
    .from("progresso_usuario")
    .select("*")
    .eq("usuario_id", userId)
    .eq("status", "in_progress")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[session-store] Erro ao carregar sessão:", error);
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    userId: data.usuario_id,
    pacoteId: data.pacote_id,
    currentBlock: data.current_block,
    currentQuestionIndex: data.current_question_index,
    score: data.score,
    errorsInBlock: data.errors_in_block,
    retryQueue: data.retry_queue ?? [],
    totalCorrect: data.total_correct,
    totalAnswered: data.total_answered,
  };
}

/**
 * Marks a session as completed.
 */
export async function completeSession(
  userId: string,
  pacoteId: string
): Promise<void> {
  const supabase = (await createClient()) as any;

  const { error } = await supabase
    .from("progresso_usuario")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("usuario_id", userId)
    .eq("pacote_id", pacoteId);

  if (error) {
    console.error("[session-store] Erro ao completar sessão:", error);
  }
}
