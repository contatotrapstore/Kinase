-- ============================================================
-- Kinase MVP — Schema Inicial
-- Migração 001: Tabelas principais, índices e políticas RLS
-- ============================================================

-- Extensão para gen_random_uuid() (já habilitada por padrão no Supabase)
create extension if not exists "pgcrypto";

-- ============================================================
-- TABELAS
-- ============================================================

-- Áreas de conhecimento (especialidades médicas)
create table areas_conhecimento (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  created_at timestamptz not null    default now()
);

-- Pacotes de questões (gerados a partir de um PDF)
create table pacotes (
  id                uuid        primary key default gen_random_uuid(),
  area_id           uuid        not null references areas_conhecimento(id) on delete cascade,
  parent_pacote_id  uuid        references pacotes(id) on delete set null,
  name              text        not null,
  source_pdf_url    text,
  tamanho           int         not null check (tamanho in (10, 20, 30)),
  status            text        not null default 'pending'
                                check (status in ('pending', 'processing', 'ready', 'error')),
  total_questions   int         not null default 0,
  created_at        timestamptz not null default now()
);

-- Questões individuais dentro de um pacote
create table questoes (
  id                   uuid        primary key default gen_random_uuid(),
  pacote_id            uuid        not null references pacotes(id) on delete cascade,
  question_order       int         not null,
  text                 text        not null,
  image_url            text,
  explanation          text,
  created_at           timestamptz not null default now()
);

-- Alternativas de cada questão (apenas A, B, C, D)
create table opcoes (
  id          uuid    primary key default gen_random_uuid(),
  questao_id  uuid    not null references questoes(id) on delete cascade,
  label       text    not null check (label in ('A', 'B', 'C', 'D')),
  text        text    not null,
  is_correct  boolean not null default false
);

-- Usuários cadastrados (identificados pelo telefone/WhatsApp)
create table usuarios (
  id          uuid        primary key default gen_random_uuid(),
  phone       text        unique not null,
  name        text,
  whatsapp_id text,
  active      boolean     not null default true,
  created_at  timestamptz not null default now()
);

-- Progresso do usuário em cada pacote de questões (lógica QBL)
create table progresso_usuario (
  id                     uuid        primary key default gen_random_uuid(),
  usuario_id             uuid        not null references usuarios(id) on delete cascade,
  pacote_id              uuid        not null references pacotes(id) on delete cascade,
  current_block          int         not null default 1,
  current_question_index int         not null default 0,
  score                  int         not null default 0,
  errors_in_block        int         not null default 0,
  status                 text        not null default 'not_started'
                                     check (status in ('not_started', 'in_progress', 'completed')),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  unique (usuario_id, pacote_id)
);

-- Respostas individuais do usuário
create table respostas (
  id                 uuid        primary key default gen_random_uuid(),
  usuario_id         uuid        not null references usuarios(id) on delete cascade,
  questao_id         uuid        not null references questoes(id) on delete cascade,
  selected_option_id uuid        references opcoes(id) on delete set null,
  is_correct         boolean     not null,
  answered_at        timestamptz not null default now(),
  was_retry          boolean     not null default false
);

-- Ranking consolidado por usuário × pacote
create table rankings (
  id             uuid           primary key default gen_random_uuid(),
  usuario_id     uuid           not null references usuarios(id) on delete cascade,
  pacote_id      uuid           not null references pacotes(id) on delete cascade,
  total_score    int            not null default 0,
  total_correct  int            not null default 0,
  total_answered int            not null default 0,
  accuracy_pct   numeric(5, 2) not null default 0,
  updated_at     timestamptz    not null default now(),

  unique (usuario_id, pacote_id)
);

-- Pesquisas pós-pacote (avaliação do usuário)
create table pesquisas (
  id            uuid        primary key default gen_random_uuid(),
  usuario_id    uuid        not null references usuarios(id) on delete cascade,
  pacote_id     uuid        not null references pacotes(id) on delete cascade,
  rating        integer     check (rating >= 1 and rating <= 5),
  feedback_text text,
  created_at    timestamptz default now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================

-- pacotes
create index idx_pacotes_area_id   on pacotes(area_id);
create index idx_pacotes_parent_id on pacotes(parent_pacote_id);
create index idx_pacotes_status    on pacotes(status);

-- questoes
create index idx_questoes_pacote_id on questoes(pacote_id);
create index idx_questoes_order     on questoes(pacote_id, question_order);

-- opcoes
create index idx_opcoes_questao_id on opcoes(questao_id);

-- progresso_usuario
create index idx_progresso_usuario_usuario_id on progresso_usuario(usuario_id);
create index idx_progresso_usuario_pacote_id  on progresso_usuario(pacote_id);
create index idx_progresso_usuario_status     on progresso_usuario(status);

-- respostas
create index idx_respostas_usuario_id  on respostas(usuario_id);
create index idx_respostas_questao_id  on respostas(questao_id);
create index idx_respostas_answered_at on respostas(answered_at);

-- rankings
create index idx_rankings_usuario_id  on rankings(usuario_id);
create index idx_rankings_pacote_id   on rankings(pacote_id);
create index idx_rankings_total_score on rankings(total_score desc);

-- usuarios
create index idx_usuarios_phone on usuarios(phone);

-- pesquisas
create index idx_pesquisas_usuario_id on pesquisas(usuario_id);
create index idx_pesquisas_pacote_id  on pesquisas(pacote_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table areas_conhecimento   enable row level security;
alter table pacotes              enable row level security;
alter table questoes             enable row level security;
alter table opcoes               enable row level security;
alter table usuarios             enable row level security;
alter table progresso_usuario    enable row level security;
alter table respostas            enable row level security;
alter table rankings             enable row level security;
alter table pesquisas            enable row level security;

-- Políticas para usuários autenticados (leitura e escrita)
-- Em produção, refinar conforme papéis (admin, médico, usuário)

create policy "Authenticated users can read areas_conhecimento"
  on areas_conhecimento for select to authenticated using (true);

create policy "Authenticated users can manage areas_conhecimento"
  on areas_conhecimento for all to authenticated using (true) with check (true);

create policy "Authenticated users can read pacotes"
  on pacotes for select to authenticated using (true);

create policy "Authenticated users can manage pacotes"
  on pacotes for all to authenticated using (true) with check (true);

create policy "Authenticated users can read questoes"
  on questoes for select to authenticated using (true);

create policy "Authenticated users can manage questoes"
  on questoes for all to authenticated using (true) with check (true);

create policy "Authenticated users can read opcoes"
  on opcoes for select to authenticated using (true);

create policy "Authenticated users can manage opcoes"
  on opcoes for all to authenticated using (true) with check (true);

create policy "Authenticated users can read usuarios"
  on usuarios for select to authenticated using (true);

create policy "Authenticated users can manage usuarios"
  on usuarios for all to authenticated using (true) with check (true);

create policy "Authenticated users can read progresso_usuario"
  on progresso_usuario for select to authenticated using (true);

create policy "Authenticated users can manage progresso_usuario"
  on progresso_usuario for all to authenticated using (true) with check (true);

create policy "Authenticated users can read respostas"
  on respostas for select to authenticated using (true);

create policy "Authenticated users can manage respostas"
  on respostas for all to authenticated using (true) with check (true);

create policy "Authenticated users can read rankings"
  on rankings for select to authenticated using (true);

create policy "Authenticated users can manage rankings"
  on rankings for all to authenticated using (true) with check (true);

create policy "Authenticated users can read pesquisas"
  on pesquisas for select to authenticated using (true);

create policy "Authenticated users can manage pesquisas"
  on pesquisas for all to authenticated using (true) with check (true);
