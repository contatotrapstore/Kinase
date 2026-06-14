import { createServiceClient } from "@/lib/supabase/service";

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
  questionsInBlock?: string[];   // array EXATO de IDs do bloco atual (com carry-over) — restaura sem reconstruir
  carryOverCount?: number;       // quantas das primeiras questionsInBlock são revisão
  awaitingDifficulty?: AwaitingDifficulty | null;  // payload pendente entre resposta A-E e feedback
  lastQuestionSentAt?: string | null;  // timestamp ISO de quando a última questão foi enviada (cálculo de tempo de resposta)
}

/**
 * Estado "aguardando avaliação F/M/D" — usuário já respondeu A-E, mas
 * ainda não disse se achou Fácil/Médio/Difícil. Salvo até resposta F/M/D
 * chegar (ou comando que cancele).
 */
export interface AwaitingDifficulty {
  respostaId: string;            // id em respostas — pra UPDATE difficulty_rating depois
  questionId: string;
  selectedOptionId: string;
  isCorrect: boolean;
  correctOption: { label: string; text: string } | null;
  explanation: string;
  blockCompleted: boolean;
  advancedToNextBlock: boolean;
  skippedNoGabarito?: boolean;
  retryQueueAfter: string[];     // retryQueue resultante (passa pro carry-over no avanço)
  errorsInBlockAfter: number;
}

/**
 * Persists session progress to progresso_usuario via UPSERT.
 */
export async function saveSession(
  userId: string,
  pacoteId: string,
  data: SessionData
): Promise<void> {
  const supabase = createServiceClient() as any;

  const { error } = await supabase.from("progresso_usuario").upsert(
    {
      usuario_id: userId,
      pacote_id: pacoteId,
      current_block: data.currentBlock,
      current_question_index: data.currentQuestionIndex,
      score: data.score,
      errors_in_block: data.errorsInBlock,
      retry_queue: data.retryQueue,
      questions_in_block: data.questionsInBlock ?? null,
      carry_over_count: data.carryOverCount ?? 0,
      awaiting_difficulty: data.awaitingDifficulty ?? null,
      last_question_sent_at: data.lastQuestionSentAt ?? null,
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
  const supabase = createServiceClient() as any;

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
    questionsInBlock: data.questions_in_block ?? undefined,
    carryOverCount: data.carry_over_count ?? 0,
    awaitingDifficulty: data.awaiting_difficulty ?? null,
    lastQuestionSentAt: data.last_question_sent_at ?? null,
  };
}

/**
 * Marks a session as completed.
 */
export async function completeSession(
  userId: string,
  pacoteId: string
): Promise<void> {
  const supabase = createServiceClient() as any;

  const { error } = await supabase
    .from("progresso_usuario")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("usuario_id", userId)
    .eq("pacote_id", pacoteId);

  if (error) {
    console.error("[session-store] Erro ao completar sessão:", error);
  }
}
