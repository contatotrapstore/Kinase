// ============================================================
// Supabase Database Types — Kinase MVP
// Gerado manualmente a partir do schema
// Em produção, usar: npx supabase gen types typescript
// ============================================================

export interface Database {
  public: {
    Tables: {
      areas_conhecimento: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
      };

      pacotes: {
        Row: {
          id: string;
          area_id: string;
          parent_pacote_id: string | null;
          name: string;
          source_pdf_url: string | null;
          tamanho: 10 | 20 | 30;
          status: 'pending' | 'processing' | 'ready' | 'error';
          total_questions: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          area_id: string;
          parent_pacote_id?: string | null;
          name: string;
          source_pdf_url?: string | null;
          tamanho: 10 | 20 | 30;
          status?: 'pending' | 'processing' | 'ready' | 'error';
          total_questions?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          area_id?: string;
          parent_pacote_id?: string | null;
          name?: string;
          source_pdf_url?: string | null;
          tamanho?: 10 | 20 | 30;
          status?: 'pending' | 'processing' | 'ready' | 'error';
          total_questions?: number;
          created_at?: string;
        };
      };

      questoes: {
        Row: {
          id: string;
          pacote_id: string;
          question_order: number;
          text: string;
          image_url: string | null;
          explanation: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          pacote_id: string;
          question_order: number;
          text: string;
          image_url?: string | null;
          explanation?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          pacote_id?: string;
          question_order?: number;
          text?: string;
          image_url?: string | null;
          explanation?: string | null;
          created_at?: string;
        };
      };

      opcoes: {
        Row: {
          id: string;
          questao_id: string;
          label: 'A' | 'B' | 'C' | 'D';
          text: string;
          is_correct: boolean;
        };
        Insert: {
          id?: string;
          questao_id: string;
          label: 'A' | 'B' | 'C' | 'D';
          text: string;
          is_correct?: boolean;
        };
        Update: {
          id?: string;
          questao_id?: string;
          label?: 'A' | 'B' | 'C' | 'D';
          text?: string;
          is_correct?: boolean;
        };
      };

      usuarios: {
        Row: {
          id: string;
          phone: string;
          name: string | null;
          whatsapp_id: string | null;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          phone: string;
          name?: string | null;
          whatsapp_id?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          phone?: string;
          name?: string | null;
          whatsapp_id?: string | null;
          active?: boolean;
          created_at?: string;
        };
      };

      progresso_usuario: {
        Row: {
          id: string;
          usuario_id: string;
          pacote_id: string;
          current_block: number;
          current_question_index: number;
          score: number;
          errors_in_block: number;
          status: 'not_started' | 'in_progress' | 'completed';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          usuario_id: string;
          pacote_id: string;
          current_block?: number;
          current_question_index?: number;
          score?: number;
          errors_in_block?: number;
          status?: 'not_started' | 'in_progress' | 'completed';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          usuario_id?: string;
          pacote_id?: string;
          current_block?: number;
          current_question_index?: number;
          score?: number;
          errors_in_block?: number;
          status?: 'not_started' | 'in_progress' | 'completed';
          created_at?: string;
          updated_at?: string;
        };
      };

      respostas: {
        Row: {
          id: string;
          usuario_id: string;
          questao_id: string;
          selected_option_id: string | null;
          is_correct: boolean;
          answered_at: string;
          was_retry: boolean;
        };
        Insert: {
          id?: string;
          usuario_id: string;
          questao_id: string;
          selected_option_id?: string | null;
          is_correct: boolean;
          answered_at?: string;
          was_retry?: boolean;
        };
        Update: {
          id?: string;
          usuario_id?: string;
          questao_id?: string;
          selected_option_id?: string | null;
          is_correct?: boolean;
          answered_at?: string;
          was_retry?: boolean;
        };
      };

      rankings: {
        Row: {
          id: string;
          usuario_id: string;
          pacote_id: string;
          total_score: number;
          total_correct: number;
          total_answered: number;
          accuracy_pct: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          usuario_id: string;
          pacote_id: string;
          total_score?: number;
          total_correct?: number;
          total_answered?: number;
          accuracy_pct?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          usuario_id?: string;
          pacote_id?: string;
          total_score?: number;
          total_correct?: number;
          total_answered?: number;
          accuracy_pct?: number;
          updated_at?: string;
        };
      };

      pesquisas: {
        Row: {
          id: string;
          usuario_id: string;
          pacote_id: string;
          rating: number | null;
          feedback_text: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          usuario_id: string;
          pacote_id: string;
          rating?: number | null;
          feedback_text?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          usuario_id?: string;
          pacote_id?: string;
          rating?: number | null;
          feedback_text?: string | null;
          created_at?: string;
        };
      };
    };

    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// Atalhos para uso direto nos componentes e serviços
export type Tables = Database['public']['Tables'];

export type AreaConhecimento = Tables['areas_conhecimento']['Row'];
export type Pacote = Tables['pacotes']['Row'];
export type Questao = Tables['questoes']['Row'];
export type Opcao = Tables['opcoes']['Row'];
export type Usuario = Tables['usuarios']['Row'];
export type ProgressoUsuario = Tables['progresso_usuario']['Row'];
export type Resposta = Tables['respostas']['Row'];
export type Ranking = Tables['rankings']['Row'];
export type Pesquisa = Tables['pesquisas']['Row'];
