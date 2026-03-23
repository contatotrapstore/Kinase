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
 * Tamanhos progressivos dos blocos: bloco 1 = 10, bloco 2 = 20, bloco 3 = 30
 * Pacotes maiores são extensões dos menores (o de 20 contém as 10 do pacote de 10)
 */
export const BLOCK_SIZES = [10, 20, 30] as const;

/**
 * Retorna a configuração de um bloco pelo número.
 * Blocos além do array repetem o último tamanho disponível.
 */
export function getBlockConfig(blockNumber: number): BlockConfig {
  const index = Math.min(blockNumber - 1, BLOCK_SIZES.length - 1);
  const size = BLOCK_SIZES[index] ?? BLOCK_SIZES[BLOCK_SIZES.length - 1];
  return { blockNumber, size };
}

/**
 * Inicializa o estado de um bloco a partir das questões disponíveis.
 * Seleciona as questões correspondentes ao bloco (pela ordem).
 */
export function initializeBlock(
  questions: Question[],
  blockNumber: number,
): QBLState {
  const config = getBlockConfig(blockNumber);

  // Calcula o offset: soma dos tamanhos dos blocos anteriores
  let offset = 0;
  for (let b = 1; b < blockNumber; b++) {
    offset += getBlockConfig(b).size;
  }

  // Seleciona as questões do bloco atual (respeitando a ordem)
  const sorted = [...questions].sort((a, b) => a.questionOrder - b.questionOrder);
  const blockQuestions = sorted.slice(offset, offset + config.size);

  return {
    currentBlock: config,
    questionsInBlock: blockQuestions.map((q) => q.id),
    currentIndex: 0,
    errorsInBlock: 0,
    retryQueue: [],
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
  if (!correctOption) {
    throw new Error(`Nenhuma alternativa correta encontrada para a questão ${questionId}`);
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
    if (newState.retryQueue.length > 0) {
      // Ainda há questões para revisar — recarrega o bloco com a fila
      newState.questionsInBlock = [...newState.retryQueue];
      newState.retryQueue = [];
      newState.currentIndex = 0;
    } else {
      // Bloco finalizado sem pendências
      blockCompleted = true;
      const nextBlock = getNextBlock(state.currentBlock.blockNumber);
      advancedToNextBlock = nextBlock !== null;
    }
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
 * Retorna a configuração do próximo bloco, ou null se não houver mais blocos.
 * Limita ao número de blocos definidos em BLOCK_SIZES.
 */
export function getNextBlock(currentBlock: number): BlockConfig | null {
  if (currentBlock >= BLOCK_SIZES.length) {
    return null;
  }
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
