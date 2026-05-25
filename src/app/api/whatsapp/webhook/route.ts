import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/service";
import { EvolutionWhatsAppAdapter } from "@/lib/whatsapp/evolution";
import { ZApiWhatsAppAdapter } from "@/lib/whatsapp/zapi";
import type { WhatsAppAdapter, WhatsAppMessage } from "@/lib/whatsapp/adapter";
import type { Question, Option, QBLState } from "@/lib/qbl/types";
import { initializeBlock, processAnswer } from "@/lib/qbl/engine";
import {
  buildRanking,
  formatRankingMessage,
  type RankingEntry,
} from "@/lib/ranking/calculator";
import {
  welcomeMessage,
  helpMessage,
  questionMessage,
  feedbackMessage,
  rankingMessage,
  progressMessage,
} from "@/lib/whatsapp/messages";
import { saveSession, loadSession, completeSession } from "@/lib/whatsapp/session-store";

// ============================================================
// Types and in-memory session state
// ============================================================

/** User record from Supabase */
interface DbUser {
  id: string;
  phone: string;
  name: string | null;
}

/** In-memory progress tracker per user phone number */
interface UserSession {
  user: DbUser;
  pacoteId: string;
  state: QBLState;
  score: number;
  totalCorrect: number;
  totalAnswered: number;
  /** Cache of questions for the active pacote to avoid repeated fetches */
  questions: Question[];
}

/** In-memory store of active sessions keyed by phone number */
const sessions = new Map<string, UserSession>();

// ============================================================
// Supabase data access helpers
// ============================================================

/**
 * Finds a user by phone, or creates one if none exists.
 */
async function getOrCreateUser(phone: string): Promise<DbUser> {
  const supabase = createServiceClient() as any;

  // Try to find existing user
  const { data: existing, error: findError } = await supabase
    .from("usuarios")
    .select("id, phone, name")
    .eq("phone", phone)
    .maybeSingle();

  if (findError) {
    console.error("[webhook] Erro ao buscar usuário:", findError);
    throw findError;
  }

  if (existing) {
    return existing as DbUser;
  }

  // Create new user
  const { data: created, error: createError } = await supabase
    .from("usuarios")
    .insert({ phone, name: phone.slice(-4) })
    .select("id, phone, name")
    .single();

  if (createError) {
    console.error("[webhook] Erro ao criar usuário:", createError);
    throw createError;
  }

  return created as DbUser;
}

/**
 * Fetches the pacote with the most answerable questions (i.e. questions
 * with a marked gabarito) and returns those questions ordered by question_order.
 * Filters out questions without is_correct=true option (would always fail).
 * Returns { pacoteId, questions } or null if no answerable questions exist.
 */
async function getReadyPacoteQuestions(): Promise<{
  pacoteId: string;
  questions: Question[];
} | null> {
  const supabase = createServiceClient() as any;

  // Inner join garante: só questões com pelo menos 1 opcao is_correct=true
  const { data: rows, error } = await supabase
    .from("questoes")
    .select(
      "id, pacote_id, question_order, text, image_url, explanation, source, created_at, opcoes!inner(id), pacotes!inner(status)"
    )
    .eq("opcoes.is_correct", true)
    .eq("pacotes.status", "ready")
    .order("question_order", { ascending: true });

  if (error) {
    console.error("[webhook] Erro ao buscar questões respondíveis:", error);
    throw error;
  }

  if (!rows || rows.length === 0) {
    return null;
  }

  // Agrupar por pacote, escolher o que tem mais questões respondíveis
  const byPacote: Record<string, any[]> = {};
  for (const r of rows as any[]) {
    if (!byPacote[r.pacote_id]) byPacote[r.pacote_id] = [];
    byPacote[r.pacote_id].push(r);
  }

  const bestPacoteId = Object.entries(byPacote).sort(
    (a, b) => b[1].length - a[1].length,
  )[0]?.[0];

  if (!bestPacoteId) return null;

  const questions: Question[] = byPacote[bestPacoteId].map((r: any) => ({
    id: r.id,
    bankId: r.pacote_id,
    questionOrder: r.question_order,
    text: r.text,
    imageUrl: r.image_url ?? null,
    type: "multiple_choice" as const,
    explanationOriginal: r.explanation ?? null,
    explanationRewritten: null,
    createdAt: r.created_at,
    source: r.source ?? null,
  }));

  return { pacoteId: bestPacoteId, questions };
}

/**
 * Fetches answerable questions (com gabarito) for a specific pacote by ID.
 * Used to restore sessions from persistent storage.
 */
async function getQuestionsForPacote(pacoteId: string): Promise<Question[]> {
  const supabase = createServiceClient() as any;

  const { data: rows, error } = await supabase
    .from("questoes")
    .select(
      "id, pacote_id, question_order, text, image_url, explanation, source, created_at, opcoes!inner(id)"
    )
    .eq("pacote_id", pacoteId)
    .eq("opcoes.is_correct", true)
    .order("question_order", { ascending: true });

  if (error) {
    console.error("[webhook] Erro ao buscar questões do pacote:", error);
    return [];
  }

  return (rows ?? []).map((r: any) => ({
    id: r.id,
    bankId: r.pacote_id,
    questionOrder: r.question_order,
    text: r.text,
    imageUrl: r.image_url ?? null,
    type: "multiple_choice" as const,
    explanationOriginal: r.explanation ?? null,
    explanationRewritten: null,
    createdAt: r.created_at,
    source: r.source ?? null,
  }));
}

/**
 * Busca o próximo pacote respondível pro usuário,
 * pulando pacotes que ele já completou. Usado quando o usuário esgota
 * todas as questões respondíveis do pacote atual e queremos avançar
 * pra um novo pacote em vez de repetir.
 */
async function getNextReadyPacote(userId: string): Promise<{
  pacoteId: string;
  name: string;
  questions: Question[];
} | null> {
  const supabase = createServiceClient() as any;

  // IDs de pacotes que o usuário já completou (não repetir)
  const { data: completed } = await supabase
    .from("progresso_usuario")
    .select("pacote_id")
    .eq("usuario_id", userId)
    .eq("status", "completed");
  const completedIds = new Set((completed ?? []).map((p: any) => p.pacote_id));

  // Mesma lógica do getReadyPacoteQuestions, mas pulando os completados
  const { data: rows, error } = await supabase
    .from("questoes")
    .select(
      "id, pacote_id, question_order, text, image_url, explanation, source, created_at, opcoes!inner(id), pacotes!inner(status, name)"
    )
    .eq("opcoes.is_correct", true)
    .eq("pacotes.status", "ready")
    .order("question_order", { ascending: true });

  if (error || !rows || rows.length === 0) return null;

  const byPacote: Record<string, { name: string; rows: any[] }> = {};
  for (const r of rows as any[]) {
    if (completedIds.has(r.pacote_id)) continue;
    if (!byPacote[r.pacote_id]) byPacote[r.pacote_id] = { name: r.pacotes?.name ?? "", rows: [] };
    byPacote[r.pacote_id].rows.push(r);
  }

  const best = Object.entries(byPacote).sort((a, b) => b[1].rows.length - a[1].rows.length)[0];
  if (!best) return null;

  const [bestPacoteId, { name, rows: pacoteRows }] = best;
  const questions: Question[] = pacoteRows.map((r: any) => ({
    id: r.id,
    bankId: r.pacote_id,
    questionOrder: r.question_order,
    text: r.text,
    imageUrl: r.image_url ?? null,
    type: "multiple_choice" as const,
    explanationOriginal: r.explanation ?? null,
    explanationRewritten: null,
    createdAt: r.created_at,
    source: r.source ?? null,
  }));

  return { pacoteId: bestPacoteId, name, questions };
}

/**
 * Fetches opcoes for a given question ID and maps to the Option type.
 */
async function getOptions(questionId: string): Promise<Option[]> {
  const supabase = createServiceClient() as any;

  const { data: rows, error } = await supabase
    .from("opcoes")
    .select("id, questao_id, label, text, is_correct")
    .eq("questao_id", questionId)
    .order("label", { ascending: true });

  if (error) {
    console.error("[webhook] Erro ao buscar opções:", error);
    throw error;
  }

  return (rows ?? []).map((r: any) => ({
    id: r.id,
    questionId: r.questao_id,
    label: r.label,
    text: r.text,
    isCorrect: r.is_correct,
  }));
}

/**
 * Fetches ranking entries from the rankings table joined with usuarios.
 */
async function getRankingEntries(): Promise<Omit<RankingEntry, "position">[]> {
  const supabase = createServiceClient() as any;

  const { data: rows, error } = await supabase
    .from("rankings")
    .select("usuario_id, total_score, total_correct, total_answered, accuracy_pct, usuarios(name)");

  if (error) {
    console.error("[webhook] Erro ao buscar ranking:", error);
    throw error;
  }

  return (rows ?? []).map((r: any) => ({
    userId: r.usuario_id,
    userName: r.usuarios?.name ?? "Anônimo",
    totalScore: r.total_score,
    totalCorrect: r.total_correct,
    totalAnswered: r.total_answered,
    accuracyPct: Number(r.accuracy_pct),
  }));
}

/**
 * Inserts an answer record into the respostas table.
 */
async function saveAnswer(
  userId: string,
  questionId: string,
  selectedOptionId: string,
  isCorrect: boolean,
  wasRetry: boolean
): Promise<void> {
  const supabase = createServiceClient() as any;

  const { error } = await supabase.from("respostas").insert({
    usuario_id: userId,
    questao_id: questionId,
    selected_option_id: selectedOptionId,
    is_correct: isCorrect,
    was_retry: wasRetry,
  });

  if (error) {
    console.error("[webhook] Erro ao salvar resposta:", error);
    // Non-fatal: log but don't throw so the user flow continues
  }
}

/**
 * Upserts the user's ranking for the given pacote.
 */
async function upsertRanking(
  userId: string,
  pacoteId: string,
  totalScore: number,
  totalCorrect: number,
  totalAnswered: number
): Promise<void> {
  const supabase = createServiceClient() as any;
  const accuracyPct =
    totalAnswered > 0
      ? Math.round((totalCorrect / totalAnswered) * 10000) / 100
      : 0;

  const { error } = await supabase.from("rankings").upsert(
    {
      usuario_id: userId,
      pacote_id: pacoteId,
      total_score: totalScore,
      total_correct: totalCorrect,
      total_answered: totalAnswered,
      accuracy_pct: accuracyPct,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "usuario_id,pacote_id" }
  );

  if (error) {
    console.error("[webhook] Erro ao atualizar ranking:", error);
    // Non-fatal
  }
}

// ============================================================
// Provider detection and adapter factory
// ============================================================

/**
 * Detects the WhatsApp provider based on the WHATSAPP_API_URL env var
 * and returns the appropriate adapter instance.
 *
 * Default: Z-API. Se WHATSAPP_API_URL contiver "evolution" ou for um
 * endereço local (localhost / 127.0.0.1), usa Evolution API.
 */
function createWhatsAppAdapter(): WhatsAppAdapter {
  const apiUrl = env.WHATSAPP_API_URL.toLowerCase();

  if (
    apiUrl.includes("evolution") ||
    apiUrl.includes("localhost") ||
    apiUrl.includes("127.0.0.1")
  ) {
    // Evolution API
    return new EvolutionWhatsAppAdapter({
      apiUrl: env.WHATSAPP_API_URL,
      apiKey: env.WHATSAPP_API_TOKEN,
      instanceName: "default",
    });
  }

  // Default: Z-API
  return new ZApiWhatsAppAdapter({
    instanceId: env.ZAPI_INSTANCE_ID,
    token: env.ZAPI_TOKEN,
    securityToken: env.WHATSAPP_API_TOKEN,
  });
}

// ============================================================
// Webhook handlers
// ============================================================

/**
 * POST /api/whatsapp/webhook
 *
 * Receives incoming messages from WhatsApp (via Evolution API or Z-API),
 * parses the webhook payload, and routes the user's input to the
 * appropriate command handler or QBL answer processor.
 *
 * Flow:
 * 1. Parse the raw JSON body from the webhook
 * 2. Detect the WhatsApp provider and instantiate the correct adapter
 * 3. Use the adapter to extract a normalized WhatsAppMessage
 * 4. Route the message text to the matching command or answer handler
 * 5. Send the response back to the user via the adapter
 */
export async function POST(request: NextRequest) {
  // Declarados fora do try pra que o catch global possa avisar o usuário
  let adapterForCatch: WhatsAppAdapter | null = null;
  let phoneForCatch: string | null = null;
  try {
    const body = await request.json();

    // Validate webhook secret if configured.
    // Z-API não aceita header customizado padrão, então também aceitamos
    // o secret via query param ?secret=... (configurado na URL do webhook na Z-API).
    const webhookSecret = env.WHATSAPP_WEBHOOK_SECRET;
    if (webhookSecret) {
      const url = new URL(request.url);
      const provided =
        request.headers.get('x-webhook-secret') ??
        request.headers.get('authorization')?.replace('Bearer ', '') ??
        url.searchParams.get('secret') ??
        url.searchParams.get('token');
      if (provided !== webhookSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    console.log(
      "[webhook] Payload recebido:",
      JSON.stringify(body).slice(0, 300)
    );

    // --- 1. Create adapter and parse the incoming message ---
    const adapter = createWhatsAppAdapter();
    adapterForCatch = adapter;
    let message: WhatsAppMessage | null = adapter.parseWebhook(body);

    // Fallback: accept generic test format { phone, text } or { from, body }
    if (!message || !message.text) {
      const data = body as Record<string, unknown>;
      const fallbackFrom =
        (data.phone as string) ??
        (data.from as string) ??
        ((data.message as Record<string, unknown>)?.from as string);
      const fallbackText =
        (data.text as string) ??
        (data.body as string) ??
        ((data.message as Record<string, unknown>)?.body as string);

      if (fallbackFrom && fallbackText) {
        message = {
          from: fallbackFrom,
          text: fallbackText,
          timestamp: new Date(),
        };
      }
    }

    // Persistir TODA mensagem recebida em whatsapp_log (sucesso ou ignorada)
    // Permite diagnosticar bugs como "bot não responde" investigando payloads reais
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = createServiceClient() as any;
      await supabase.from("whatsapp_log").insert({
        raw_payload: body,
        parsed_phone: message?.from ?? null,
        parsed_text: message?.text ?? null,
        action: message && message.text ? "received" : "ignored_no_message",
        details: !message || !message.text
          ? "Payload não reconhecido pelo parser nem pelo fallback"
          : null,
      });
    } catch (logErr) {
      // Log persistence failure não pode quebrar o webhook
      console.error("[webhook] Falha ao gravar whatsapp_log:", logErr);
    }

    if (!message || !message.text) {
      // No actionable message (media-only, status update, etc.) — acknowledge silently
      console.warn(
        "[webhook] IGNORED — payload sem from/text reconhecível:",
        JSON.stringify(body).slice(0, 500),
      );
      return NextResponse.json({ success: true, action: "ignored" });
    }

    const phone = message.from;
    phoneForCatch = phone;
    const text = message.text.trim();

    console.log(`[webhook] Mensagem de ${phone}: "${text}"`);

    // --- Restore session from DB if not in memory ---
    if (!sessions.has(phone)) {
      const user = await getOrCreateUser(phone);
      if (user) {
        const saved = await loadSession(user.id);
        if (saved) {
          const questions = await getQuestionsForPacote(saved.pacoteId);
          if (questions.length > 0) {
            // CRÍTICO: restaurar o array EXATO que foi exibido (não reconstruir),
            // senão o índice aponta pra questão errada (comentário não bate).
            const restoredBlock =
              saved.questionsInBlock && saved.questionsInBlock.length > 0
                ? saved.questionsInBlock
                : initializeBlock(questions, saved.currentBlock).questionsInBlock;
            const state: QBLState = {
              currentBlock: { blockNumber: saved.currentBlock, size: restoredBlock.length },
              questionsInBlock: restoredBlock,
              currentIndex: saved.currentQuestionIndex,
              errorsInBlock: saved.errorsInBlock,
              retryQueue: saved.retryQueue,
              carryOverCount: saved.carryOverCount,
            };
            sessions.set(phone, {
              user: { id: user.id, phone: user.phone, name: user.name },
              pacoteId: saved.pacoteId,
              state,
              score: saved.score,
              totalCorrect: saved.totalCorrect,
              totalAnswered: saved.totalAnswered,
              questions,
            });
          }
        }
      }
    }

    // --- 2. Route to command or answer handler ---
    const command = text.toLowerCase();

    if (command === "/start" || command === "/iniciar") {
      await handleStart(adapter, phone);
    } else if (command === "/restart" || command === "/reiniciar") {
      await handleRestart(adapter, phone);
    } else if (command === "/ranking") {
      await handleRanking(adapter, phone);
    } else if (command === "/progresso") {
      await handleProgress(adapter, phone);
    } else if (command === "/ajuda" || command === "/help") {
      await handleHelp(adapter, phone);
    } else if (/^[a-d]$/i.test(command)) {
      await handleAnswer(adapter, phone, command.toUpperCase());
    } else {
      await adapter.sendText(
        phone,
        'Comando não reconhecido. Envie */ajuda* para ver os comandos disponíveis.'
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[webhook] Erro ao processar webhook:", error);
    // Best-effort: avisar usuário antes de retornar 500 (Z-API consumiria silenciosamente)
    if (adapterForCatch && phoneForCatch) {
      try {
        await adapterForCatch.sendText(
          phoneForCatch,
          "Tive um erro processando sua mensagem. Envie */start* para recomeçar."
        );
      } catch (sendErr) {
        console.error("[webhook] Falha ao avisar usuário do erro:", sendErr);
      }
    }
    return NextResponse.json(
      { error: "Erro ao processar webhook" },
      { status: 500 }
    );
  }
}

// ============================================================
// Command handlers
// ============================================================

/**
 * Handles /start and /iniciar commands.
 * Se já há progresso ativo, RETOMA de onde parou (sem zerar score).
 * Se não, inicia bloco 1 com o pacote escolhido pelo engine.
 * Use /restart pra forçar reset.
 */
async function handleStart(
  adapter: WhatsAppAdapter,
  phone: string
): Promise<void> {
  const user = await getOrCreateUser(phone);

  // Retomar sessão se houver progresso ativo
  const existing = await loadSession(user.id);
  if (existing) {
    const questions = await getQuestionsForPacote(existing.pacoteId);
    if (questions.length > 0) {
      // Restaurar o array EXATO salvo (não reconstruir) pra não desalinhar
      const restoredBlock =
        existing.questionsInBlock && existing.questionsInBlock.length > 0
          ? existing.questionsInBlock
          : initializeBlock(questions, existing.currentBlock).questionsInBlock;
      const state: QBLState = {
        currentBlock: { blockNumber: existing.currentBlock, size: restoredBlock.length },
        questionsInBlock: restoredBlock,
        currentIndex: Math.min(existing.currentQuestionIndex, restoredBlock.length - 1),
        errorsInBlock: existing.errorsInBlock,
        retryQueue: existing.retryQueue ?? [],
        carryOverCount: existing.carryOverCount,
      };

      const session: UserSession = {
        user,
        pacoteId: existing.pacoteId,
        state,
        score: existing.score,
        totalCorrect: existing.totalCorrect,
        totalAnswered: existing.totalAnswered,
        questions,
      };
      sessions.set(phone, session);
      await adapter.sendText(
        phone,
        `*Bem-vindo de volta!* 👋\n\nVocê está no bloco ${existing.currentBlock}, questão ${state.currentIndex + 1}.\nScore atual: *${existing.score} pts* — ${existing.totalCorrect}/${existing.totalAnswered} acertos.\n\nEnvie */restart* se quiser zerar e começar do início.`
      );
      await sendCurrentQuestion(adapter, phone, session);
      return;
    }
  }

  // Sem progresso ativo → criar sessão nova com bloco 1
  const pacoteData = await getReadyPacoteQuestions();

  if (!pacoteData || pacoteData.questions.length === 0) {
    await adapter.sendText(
      phone,
      "Nenhum pacote de questões disponível no momento. Tente novamente mais tarde."
    );
    return;
  }

  const { pacoteId, questions } = pacoteData;
  const state = initializeBlock(questions, 1);

  const session: UserSession = {
    user,
    pacoteId,
    state,
    score: 0,
    totalCorrect: 0,
    totalAnswered: 0,
    questions,
  };

  sessions.set(phone, session);

  await saveSession(session.user.id, session.pacoteId, {
    userId: session.user.id,
    pacoteId: session.pacoteId,
    currentBlock: session.state.currentBlock.blockNumber,
    currentQuestionIndex: session.state.currentIndex,
    score: session.score,
    errorsInBlock: session.state.errorsInBlock,
    retryQueue: session.state.retryQueue ?? [],
    questionsInBlock: session.state.questionsInBlock,
    carryOverCount: session.state.carryOverCount ?? 0,
    totalCorrect: session.totalCorrect,
    totalAnswered: session.totalAnswered,
  });

  await adapter.sendText(phone, welcomeMessage());
  await sendCurrentQuestion(adapter, phone, session);
}

/**
 * Handles /restart and /reiniciar commands.
 * Zera progresso (in_progress e completed do user) e inicia sessão limpa.
 */
async function handleRestart(
  adapter: WhatsAppAdapter,
  phone: string,
): Promise<void> {
  const user = await getOrCreateUser(phone);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any;
  await supabase
    .from("progresso_usuario")
    .delete()
    .eq("usuario_id", user.id);
  sessions.delete(phone);
  await adapter.sendText(phone, "*Progresso zerado.* Iniciando do começo...");
  await handleStart(adapter, phone);
}

/**
 * Handles /ranking command.
 * Builds a comparative ranking from all active sessions and sends it.
 */
async function handleRanking(
  adapter: WhatsAppAdapter,
  phone: string
): Promise<void> {
  const entries = await getRankingEntries();

  if (entries.length === 0) {
    await adapter.sendText(
      phone,
      "Nenhum participante no ranking ainda. Envie */start* para começar!"
    );
    return;
  }

  // Identifica o solicitante pra destacar "👈 você" na própria linha
  const user = await getOrCreateUser(phone);
  const ranked = buildRanking(entries);
  const formatted = formatRankingMessage(ranked, 10, user.id);
  await adapter.sendText(phone, rankingMessage(formatted));
}

/**
 * Handles /progresso command.
 * Sends the user's current progress (questions answered, score).
 */
async function handleProgress(
  adapter: WhatsAppAdapter,
  phone: string
): Promise<void> {
  const session = sessions.get(phone);

  if (!session) {
    await adapter.sendText(
      phone,
      "Você ainda não iniciou. Envie */start* para começar!"
    );
    return;
  }

  const total = session.state.questionsInBlock.length;
  const current = session.state.currentIndex;

  await adapter.sendText(
    phone,
    progressMessage(current, total, session.score)
  );
}

/**
 * Handles /ajuda and /help commands.
 * Sends the help message with available commands.
 */
async function handleHelp(
  adapter: WhatsAppAdapter,
  phone: string
): Promise<void> {
  await adapter.sendText(phone, helpMessage());
}

/**
 * Handles a single-letter answer (A/B/C/D).
 * Looks up the user's current question, processes the answer through the
 * QBL engine, sends feedback, and advances to the next question or
 * completes the block.
 */
async function handleAnswer(
  adapter: WhatsAppAdapter,
  phone: string,
  letter: string
): Promise<void> {
  const session = sessions.get(phone);

  if (!session) {
    await adapter.sendText(
      phone,
      "Você ainda não iniciou. Envie */start* para começar!"
    );
    return;
  }

  const { state } = session;

  // Check if we've gone past all questions (block already complete)
  if (state.currentIndex >= state.questionsInBlock.length) {
    await adapter.sendText(
      phone,
      "Bloco finalizado! Envie */start* para recomeçar ou */ranking* para ver o ranking."
    );
    return;
  }

  // Get current question and its options
  const currentQuestionId = state.questionsInBlock[state.currentIndex];
  const options = await getOptions(currentQuestionId);

  if (options.length === 0) {
    console.error(`[webhook] Sem opções para questão ${currentQuestionId}`);
    await adapter.sendText(phone, "Erro interno. Tente novamente.");
    return;
  }

  // Map the letter (A/B/C/D) to an option ID
  const selectedOption = options.find((o) => o.label === letter);

  if (!selectedOption) {
    await adapter.sendText(
      phone,
      `Alternativa *${letter}* não encontrada. Responda com *A*, *B*, *C* ou *D*.`
    );
    return;
  }

  // Process the answer through the QBL engine
  const { result, newState } = processAnswer(
    state,
    currentQuestionId,
    selectedOption.id,
    options
  );

  // Defesa: questão sem gabarito marcado — pula sem pontuar, avisa usuário
  if (result.skippedNoGabarito) {
    console.warn(
      `[webhook] Questão ${currentQuestionId} sem gabarito — pulando`
    );
    session.state = newState;
    await saveSession(session.user.id, session.pacoteId, {
      userId: session.user.id,
      pacoteId: session.pacoteId,
      currentBlock: session.state.currentBlock.blockNumber,
      currentQuestionIndex: session.state.currentIndex,
      score: session.score,
      errorsInBlock: session.state.errorsInBlock,
      retryQueue: session.state.retryQueue ?? [],
      questionsInBlock: session.state.questionsInBlock,
      carryOverCount: session.state.carryOverCount ?? 0,
      totalCorrect: session.totalCorrect,
      totalAnswered: session.totalAnswered,
    });
    await adapter.sendText(
      phone,
      "Essa questão está com o gabarito pendente de revisão — pulei para a próxima."
    );
    if (result.blockCompleted) {
      await completeSession(session.user.id, session.pacoteId);
      await adapter.sendText(
        phone,
        "Bloco finalizado! Envie */start* para recomeçar ou */ranking* para ver o ranking."
      );
    } else {
      await sendCurrentQuestion(adapter, phone, session);
    }
    return;
  }

  // Retrieve the explanation from the cached question data
  const questionData = session.questions.find((q) => q.id === currentQuestionId);
  const explanation =
    questionData?.explanationRewritten ??
    questionData?.explanationOriginal ??
    "";

  // Update session state
  session.state = newState;
  session.totalAnswered += 1;
  if (result.isCorrect) {
    session.totalCorrect += 1;
    session.score += 10;
  }

  // Persist answer and ranking to Supabase (non-blocking, errors are logged)
  const wasRetry = result.shouldRetry; // if the engine flagged a retry, previous attempt was a retry
  await saveAnswer(
    session.user.id,
    currentQuestionId,
    selectedOption.id,
    result.isCorrect,
    false // first attempt; retries are tracked when the question re-appears
  );
  await upsertRanking(
    session.user.id,
    session.pacoteId,
    session.score,
    session.totalCorrect,
    session.totalAnswered
  );

  // Persist session progress to DB
  await saveSession(session.user.id, session.pacoteId, {
    userId: session.user.id,
    pacoteId: session.pacoteId,
    currentBlock: session.state.currentBlock.blockNumber,
    currentQuestionIndex: session.state.currentIndex,
    score: session.score,
    errorsInBlock: session.state.errorsInBlock,
    retryQueue: session.state.retryQueue ?? [],
    questionsInBlock: session.state.questionsInBlock,
    carryOverCount: session.state.carryOverCount ?? 0,
    totalCorrect: session.totalCorrect,
    totalAnswered: session.totalAnswered,
  });

  // Send feedback (incluindo a opção correta quando errou — sem isso o usuário não aprende)
  await adapter.sendText(
    phone,
    feedbackMessage(
      result.isCorrect,
      explanation,
      result.correctOption
        ? { label: result.correctOption.label, text: result.correctOption.text }
        : null,
    ),
  );

  // Determine next step
  if (result.blockCompleted) {
    // Carry-over: erros DESTE bloco passam pro próximo bloco como revisão
    const carryOver = newState.retryQueue;
    const nextBlockNum = newState.currentBlock.blockNumber + 1;

    // Tenta inicializar próximo bloco do MESMO pacote
    const candidateState = initializeBlock(session.questions, nextBlockNum, carryOver);
    const hasNewQuestionsInNextBlock = candidateState.questionsInBlock.length > carryOver.length;
    const hasAnyToReview = candidateState.questionsInBlock.length > 0;

    if (hasNewQuestionsInNextBlock || hasAnyToReview) {
      // Avança bloco no mesmo pacote (tem novas E/OU tem revisão pra fechar)
      session.state = candidateState;
      const reviewCount = carryOver.length;
      const newCount = candidateState.questionsInBlock.length - reviewCount;
      const detalhe = reviewCount > 0
        ? `\n📚 ${reviewCount} para revisar + ${newCount} novas = ${candidateState.questionsInBlock.length} questões`
        : `\n${newCount} questões novas`;
      await adapter.sendText(
        phone,
        `*Parabéns!* Você completou o bloco ${newState.currentBlock.blockNumber}. 🎯\n\nIniciando bloco ${nextBlockNum}.${detalhe}`,
      );
      await saveSession(session.user.id, session.pacoteId, {
        userId: session.user.id,
        pacoteId: session.pacoteId,
        currentBlock: candidateState.currentBlock.blockNumber,
        currentQuestionIndex: 0,
        score: session.score,
        errorsInBlock: 0,
        retryQueue: [],
        questionsInBlock: candidateState.questionsInBlock,
        carryOverCount: candidateState.carryOverCount ?? 0,
        totalCorrect: session.totalCorrect,
        totalAnswered: session.totalAnswered,
      });
      await sendCurrentQuestion(adapter, phone, session);
    } else {
      // Pacote esgotado (sem novas + sem revisão) — migrar pra próximo pacote
      await completeSession(session.user.id, session.pacoteId);
      const nextPacote = await getNextReadyPacote(session.user.id);
      if (nextPacote) {
        const newState = initializeBlock(nextPacote.questions, 1);
        session.pacoteId = nextPacote.pacoteId;
        session.state = newState;
        session.questions = nextPacote.questions;
        await saveSession(session.user.id, session.pacoteId, {
          userId: session.user.id,
          pacoteId: session.pacoteId,
          currentBlock: newState.currentBlock.blockNumber,
          currentQuestionIndex: 0,
          score: session.score,
          errorsInBlock: 0,
          retryQueue: [],
          questionsInBlock: newState.questionsInBlock,
          carryOverCount: newState.carryOverCount ?? 0,
          totalCorrect: session.totalCorrect,
          totalAnswered: session.totalAnswered,
        });
        await adapter.sendText(
          phone,
          `*Parabéns!* Você completou o pacote anterior. 🎉\n\nIniciando novo pacote: *${nextPacote.name}*`,
        );
        await sendCurrentQuestion(adapter, phone, session);
      } else {
        await adapter.sendText(
          phone,
          "*Parabéns!* Você completou TODAS as questões disponíveis! 🏆\n\nEnvie */ranking* para ver sua posição."
        );
      }
    }
  } else {
    // Send next question (could be a retry question)
    await sendCurrentQuestion(adapter, phone, session);
  }
}

// ============================================================
// Helpers
// ============================================================

/**
 * Sends the current question from the user's session state.
 * Looks up the question ID at state.currentIndex and formats it.
 */
async function sendCurrentQuestion(
  adapter: WhatsAppAdapter,
  phone: string,
  session: UserSession
): Promise<void> {
  const { state } = session;

  if (state.currentIndex >= state.questionsInBlock.length) {
    return;
  }

  const questionId = state.questionsInBlock[state.currentIndex];
  const questionData = session.questions.find((q) => q.id === questionId);
  const options = await getOptions(questionId);

  if (!questionData || options.length === 0) {
    console.error(`[webhook] Questão ${questionId} não encontrada`);
    await adapter.sendText(phone, 'Erro ao carregar questão. Envie /start para recomeçar.');
    return;
  }

  const displayNumber = state.currentIndex + 1;
  const optionLabels = options.map((o) => ({
    label: o.label,
    text: o.text,
  }));

  // Send image first if the question has one
  if (questionData.imageUrl) {
    await adapter.sendImage(phone, questionData.imageUrl, `Questão ${displayNumber}`);
  }

  // Header de revisão quando a questão atual veio do carry-over (errada num bloco anterior)
  const isReviewQuestion =
    (state.carryOverCount ?? 0) > 0 && state.currentIndex < (state.carryOverCount ?? 0);
  if (isReviewQuestion || state.inRetryMode) {
    await adapter.sendText(
      phone,
      "📚 *Revisão* — Esta é uma questão que você errou antes. Responda novamente:",
    );
  }

  await adapter.sendText(
    phone,
    questionMessage(displayNumber, questionData.text, optionLabels, questionData.source)
  );
}

/**
 * GET /api/whatsapp/webhook
 *
 * Handles webhook verification requests. Supports:
 * - Meta/WABA challenge verification (hub.challenge param)
 * - Simple health-check (returns status JSON)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const challenge = searchParams.get("hub.challenge");

  // Validate verify_token if present
  const verifyToken = searchParams.get('hub.verify_token');
  if (verifyToken && verifyToken !== env.WHATSAPP_WEBHOOK_SECRET) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // Meta/WABA webhook verification
  if (challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ status: "Webhook ativo" });
}
