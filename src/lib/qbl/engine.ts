// ============================================================
// QBL Engine — Motor de lógica pura (sem dependências de banco)
// Recebe dados como parâmetros e retorna novos estados
// ============================================================

import type {
  BlockConfig,
  Question,
  Option,
  QBLState,
  AnswerResult,
} from './types';

/**
 * Cada bloco tem N questões NOVAS + as erradas dos blocos anteriores (carry-over).
 * Exemplo: bloco 1 = 10 novas. Errou 8 → bloco 2 = 10 novas + 8 erradas = 18.
 * Errou 7 desses 18 → bloco 3 = 10 novas + 7 erradas = 17. E assim por diante.
 */
export const BLOCK_NEW_PER_BLOCK = 10;

/**
 * Retorna a configuração de um bloco pelo número.
 * O size é dinamico (depende de quantas erradas tem carry-over),
 * mas pra retrocompatibilidade retornamos o size BASE (só novas).
 */
export function getBlockConfig(blockNumber: number): BlockConfig {
  return { blockNumber, size: BLOCK_NEW_PER_BLOCK };
}

/**
 * Inicializa o estado de um bloco a partir das questões disponíveis.
 * @param carryOverErrors - IDs de questões erradas em blocos anteriores que
 *                          devem ser revisadas neste novo bloco. Aparecem
 *                          ANTES das novas questões do bloco.
 */
export function initializeBlock(
  questions: Question[],
  blockNumber: number,
  carryOverErrors: string[] = [],
): QBLState {
  // Offset de questões NOVAS = (blockNumber - 1) * BLOCK_NEW_PER_BLOCK
  const offset = (blockNumber - 1) * BLOCK_NEW_PER_BLOCK;
  const sorted = [...questions].sort((a, b) => a.questionOrder - b.questionOrder);
  const novas = sorted.slice(offset, offset + BLOCK_NEW_PER_BLOCK).map((q) => q.id);

  // Bloco real = carry-over (revisão) + novas, sem duplicar
  const seen = new Set<string>();
  const questionsInBlock: string[] = [];
  for (const id of [...carryOverErrors, ...novas]) {
    if (!seen.has(id)) {
      seen.add(id);
      questionsInBlock.push(id);
    }
  }

  // Quantas das primeiras IDs são revisão (vieram do carry-over)
  const carryOverCount = carryOverErrors.filter((id) => seen.has(id)).length;

  return {
    currentBlock: { blockNumber, size: questionsInBlock.length },
    questionsInBlock,
    currentIndex: 0,
    errorsInBlock: 0,
    retryQueue: [],
    carryOverCount,
  };
}

/**
 * Processa a resposta do usuário e retorna o resultado + novo estado.
 * - Se errou: adiciona à fila de revisão (retryQueue)
 * - Se acertou: avança o índice
 * - Ao final do bloco (incluindo revisões), verifica avanço
 */
export function processAnswer(
  state: QBLState,
  questionId: string,
  selectedOptionId: string,
  options: Option[],
): { result: AnswerResult; newState: QBLState } {
  // Encontra a alternativa correta
  const correctOption = options.find((o) => o.isCorrect);

  // Defesa: questão sem gabarito marcado não pode ser pontuada — pulamos sem quebrar fluxo
  if (!correctOption) {
    const skippedState: QBLState = {
      ...state,
      currentBlock: { ...state.currentBlock },
      questionsInBlock: [...state.questionsInBlock],
      retryQueue: [...state.retryQueue],
      currentIndex: state.currentIndex + 1,
    };
    const skippedBlockCompleted =
      skippedState.currentIndex >= skippedState.questionsInBlock.length &&
      skippedState.retryQueue.length === 0;
    return {
      result: {
        isCorrect: false,
        correctOption: null,
        explanation: '',
        shouldRetry: false,
        blockCompleted: skippedBlockCompleted,
        advancedToNextBlock: false,
        skippedNoGabarito: true,
      },
      newState: skippedState,
    };
  }

  const isCorrect = selectedOptionId === correctOption.id;

  // Cria cópia do estado para imutabilidade
  const newState: QBLState = {
    ...state,
    currentBlock: { ...state.currentBlock },
    questionsInBlock: [...state.questionsInBlock],
    retryQueue: [...state.retryQueue],
  };

  if (!isCorrect) {
    // Errou: incrementa erros e adiciona à fila de revisão
    newState.errorsInBlock += 1;
    if (!newState.retryQueue.includes(questionId)) {
      newState.retryQueue.push(questionId);
    }
  }

  // Avança para a próxima questão
  newState.currentIndex += 1;

  // Verifica se terminou todas as questões do bloco + fila de revisão
  const allQuestionsAnswered = newState.currentIndex >= newState.questionsInBlock.length;

  let blockCompleted = false;
  let advancedToNextBlock = false;

  if (allQuestionsAnswered) {
    // Bloco terminado — retryQueue (se houver) vira carry-over pro próximo bloco,
    // NÃO repete no mesmo. Engine de aprendizado espaçado: dia X + dia X+1.
    blockCompleted = true;
    advancedToNextBlock = true; // sempre tenta avançar (chamador decide se há próximo)
  }

  const result: AnswerResult = {
    isCorrect,
    correctOption,
    explanation: '', // Será preenchido pelo chamador com dados da questão
    shouldRetry: !isCorrect,
    blockCompleted,
    advancedToNextBlock,
  };

  return { result, newState };
}

/**
 * Verifica se o bloco atual foi completado (todas as questões respondidas
 * e fila de revisão vazia).
 */
export function isBlockComplete(state: QBLState): boolean {
  return (
    state.currentIndex >= state.questionsInBlock.length &&
    state.retryQueue.length === 0
  );
}

/**
 * Retorna a configuração do próximo bloco.
 * Sempre retorna um bloco — o chamador decide se há questões novas
 * disponíveis (se não houver, avança pra outro pacote).
 */
export function getNextBlock(currentBlock: number): BlockConfig | null {
  return getBlockConfig(currentBlock + 1);
}

/**
 * Calcula pontuação e acurácia a partir de acertos/total.
 */
export function calculateScore(
  correct: number,
  total: number,
): { score: number; accuracy: number } {
  if (total === 0) {
    return { score: 0, accuracy: 0 };
  }
  const accuracy = (correct / total) * 100;
  // Pontuação: 10 pontos por acerto
  const score = correct * 10;
  return { score, accuracy: Math.round(accuracy * 100) / 100 };
}
