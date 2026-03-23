import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
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

// ============================================================
// In-memory mock data (temporary until Supabase is connected)
// ============================================================

/** Mock user record */
interface MockUser {
  id: string;
  phone: string;
  name: string;
}

/** In-memory progress tracker per user phone number */
interface UserSession {
  user: MockUser;
  state: QBLState;
  score: number;
  totalCorrect: number;
  totalAnswered: number;
}

/** In-memory store of active sessions keyed by phone number */
const sessions = new Map<string, UserSession>();

// ---- Mock questions bank ----

const MOCK_OPTIONS: Record<string, Option[]> = {
  q1: [
    { id: "q1a", questionId: "q1", label: "A", text: "Inibidor de tirosina quinase", isCorrect: true },
    { id: "q1b", questionId: "q1", label: "B", text: "Agonista beta-adrenérgico", isCorrect: false },
    { id: "q1c", questionId: "q1", label: "C", text: "Bloqueador de canal de cálcio", isCorrect: false },
    { id: "q1d", questionId: "q1", label: "D", text: "Inibidor de protease", isCorrect: false },
  ],
  q2: [
    { id: "q2a", questionId: "q2", label: "A", text: "Pulmão", isCorrect: false },
    { id: "q2b", questionId: "q2", label: "B", text: "Fígado", isCorrect: false },
    { id: "q2c", questionId: "q2", label: "C", text: "Medula óssea", isCorrect: true },
    { id: "q2d", questionId: "q2", label: "D", text: "Rim", isCorrect: false },
  ],
  q3: [
    { id: "q3a", questionId: "q3", label: "A", text: "Apoptose", isCorrect: false },
    { id: "q3b", questionId: "q3", label: "B", text: "Proliferação celular descontrolada", isCorrect: true },
    { id: "q3c", questionId: "q3", label: "C", text: "Diferenciação celular", isCorrect: false },
    { id: "q3d", questionId: "q3", label: "D", text: "Autofagia", isCorrect: false },
  ],
};

const MOCK_QUESTIONS: Question[] = [
  {
    id: "q1",
    bankId: "bank1",
    questionOrder: 1,
    text: "Qual é o mecanismo de ação do Imatinibe?",
    imageUrl: null,
    type: "multiple_choice",
    explanationOriginal: "O Imatinibe é um inibidor seletivo da tirosina quinase BCR-ABL, utilizado no tratamento da leucemia mieloide crônica.",
    explanationRewritten: "O Imatinibe atua inibindo a tirosina quinase BCR-ABL. Essa enzima está constitutivamente ativa na LMC devido à translocação t(9;22).",
    createdAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "q2",
    bankId: "bank1",
    questionOrder: 2,
    text: "Qual o principal sítio de ação da eritropoetina?",
    imageUrl: null,
    type: "multiple_choice",
    explanationOriginal: "A eritropoetina atua principalmente na medula óssea, estimulando a produção de eritrócitos.",
    explanationRewritten: "A EPO age na medula óssea estimulando a eritropoiese. É produzida nos rins em resposta à hipóxia.",
    createdAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "q3",
    bankId: "bank1",
    questionOrder: 3,
    text: "Qual o principal efeito da ativação oncogênica de quinases?",
    imageUrl: null,
    type: "multiple_choice",
    explanationOriginal: "A ativação oncogênica de quinases leva à proliferação celular descontrolada, um marco do câncer.",
    explanationRewritten: "Quinases oncogênicas promovem proliferação celular descontrolada ao ativar vias de sinalização como RAS-MAPK e PI3K-AKT de forma constitutiva.",
    createdAt: "2025-01-01T00:00:00Z",
  },
];

// ---- Mock helpers ----

/**
 * Returns a mock user for the given phone number.
 * In production this will query Supabase.
 */
function getOrCreateMockUser(phone: string): MockUser {
  return {
    id: `user_${phone}`,
    phone,
    name: phone.slice(-4), // last 4 digits as name placeholder
  };
}

/**
 * Returns mock questions for the current bank.
 * In production this will query Supabase.
 */
function getMockQuestions(): Question[] {
  return MOCK_QUESTIONS;
}

/**
 * Returns mock options for a given question ID.
 * In production this will query Supabase.
 */
function getMockOptions(questionId: string): Option[] {
  return MOCK_OPTIONS[questionId] ?? [];
}

/**
 * Returns mock ranking entries for all known sessions.
 */
function getMockRankingEntries(): Omit<RankingEntry, "position">[] {
  const entries: Omit<RankingEntry, "position">[] = [];
  for (const [, session] of sessions) {
    entries.push({
      userId: session.user.id,
      userName: session.user.name,
      totalScore: session.score,
      totalCorrect: session.totalCorrect,
      totalAnswered: session.totalAnswered,
      accuracyPct:
        session.totalAnswered > 0
          ? Math.round((session.totalCorrect / session.totalAnswered) * 10000) / 100
          : 0,
    });
  }
  return entries;
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
  try {
    const body = await request.json();

    // Validate webhook secret if configured
    const webhookSecret = env.WHATSAPP_WEBHOOK_SECRET;
    if (webhookSecret) {
      const headerSecret = request.headers.get('x-webhook-secret') ??
                           request.headers.get('authorization')?.replace('Bearer ', '');
      if (headerSecret !== webhookSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    console.log(
      "[webhook] Payload recebido:",
      JSON.stringify(body).slice(0, 300)
    );

    // --- 1. Create adapter and parse the incoming message ---
    const adapter = createWhatsAppAdapter();
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

    if (!message || !message.text) {
      // No actionable message (media-only, status update, etc.) — acknowledge silently
      return NextResponse.json({ success: true, action: "ignored" });
    }

    const phone = message.from;
    const text = message.text.trim();

    console.log(`[webhook] Mensagem de ${phone}: "${text}"`);

    // --- 2. Route to command or answer handler ---
    const command = text.toLowerCase();

    if (command === "/start" || command === "/iniciar") {
      await handleStart(adapter, phone);
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
 * Creates (or resets) the user session, initializes the first QBL block,
 * and sends the welcome message followed by the first question.
 */
async function handleStart(
  adapter: WhatsAppAdapter,
  phone: string
): Promise<void> {
  const user = getOrCreateMockUser(phone);
  const questions = getMockQuestions();
  const state = initializeBlock(questions, 1);

  const session: UserSession = {
    user,
    state,
    score: 0,
    totalCorrect: 0,
    totalAnswered: 0,
  };

  sessions.set(phone, session);

  await adapter.sendText(phone, welcomeMessage());
  await sendCurrentQuestion(adapter, phone, session);
}

/**
 * Handles /ranking command.
 * Builds a comparative ranking from all active sessions and sends it.
 */
async function handleRanking(
  adapter: WhatsAppAdapter,
  phone: string
): Promise<void> {
  const entries = getMockRankingEntries();

  if (entries.length === 0) {
    await adapter.sendText(
      phone,
      "Nenhum participante no ranking ainda. Envie */start* para começar!"
    );
    return;
  }

  const ranked = buildRanking(entries);
  const formatted = formatRankingMessage(ranked, 10);
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
  const options = getMockOptions(currentQuestionId);

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

  // Retrieve the explanation from the question data
  const questionData = getMockQuestions().find((q) => q.id === currentQuestionId);
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

  // Send feedback
  await adapter.sendText(phone, feedbackMessage(result.isCorrect, explanation));

  // Determine next step
  if (result.blockCompleted) {
    if (result.advancedToNextBlock) {
      const nextBlockNum = newState.currentBlock.blockNumber + 1;
      const questions = getMockQuestions();
      session.state = initializeBlock(questions, nextBlockNum);

      await adapter.sendText(
        phone,
        `*Parabéns!* Você completou o bloco ${newState.currentBlock.blockNumber}. Avançando para o bloco ${nextBlockNum}...`
      );
      await sendCurrentQuestion(adapter, phone, session);
    } else {
      await adapter.sendText(
        phone,
        "*Parabéns!* Você completou todos os blocos disponíveis! 🎉\n\nEnvie */ranking* para ver sua posição."
      );
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
  const questionData = getMockQuestions().find((q) => q.id === questionId);
  const options = getMockOptions(questionId);

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

  await adapter.sendText(
    phone,
    questionMessage(displayNumber, questionData.text, optionLabels)
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
