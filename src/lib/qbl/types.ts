// ============================================================
// QBL (Question-Based Learning) — Tipos
// Motor de aprendizagem progressiva por blocos de questões
// ============================================================

/** Configuração de um bloco (tamanho progressivo) */
export interface BlockConfig {
  blockNumber: number;
  size: number;
}

/** Progresso do usuário no banco de questões (espelha tabela student_progress) */
export interface StudentProgress {
  id: string;
  studentId: string;
  bankId: string;
  currentBlock: number;
  currentQuestionIndex: number;
  score: number;
  errorsInBlock: number;
  status: 'not_started' | 'in_progress' | 'completed';
  createdAt: string;
  updatedAt: string;
}

/** Alternativa de uma questão (espelha tabela options) */
export interface Option {
  id: string;
  questionId: string;
  label: 'A' | 'B' | 'C' | 'D';
  text: string;
  isCorrect: boolean;
}

/** Questão individual (espelha tabela questions) */
export interface Question {
  id: string;
  bankId: string;
  questionOrder: number;
  text: string;
  imageUrl: string | null;
  type: 'multiple_choice' | 'true_false';
  explanationOriginal: string | null;
  explanationRewritten: string | null;
  createdAt: string;
}

/** Estado interno do motor QBL durante a sessão */
export interface QBLState {
  currentBlock: BlockConfig;
  questionsInBlock: string[];    // IDs das questões no bloco atual
  currentIndex: number;          // Índice da questão atual dentro do bloco
  errorsInBlock: number;         // Erros acumulados no bloco
  retryQueue: string[];          // IDs das questões erradas para revisão
}

/** Resultado do processamento de uma resposta */
export interface AnswerResult {
  isCorrect: boolean;
  correctOption: Option;
  explanation: string;           // Explicação reescrita (ou original como fallback)
  shouldRetry: boolean;          // Questão voltará na fila de revisão
  blockCompleted: boolean;       // Bloco atual foi finalizado
  advancedToNextBlock: boolean;  // Usuário avançou para o próximo bloco
}
