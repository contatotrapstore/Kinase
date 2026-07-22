# Kinase — Guia de Onboarding para Devs

Passo-a-passo pra um dev novo entrar no projeto Kinase, rodar local, entender a arquitetura, deployar e resolver incidentes comuns.

> Este arquivo NÃO contém senhas nem tokens. Todos os secrets ficam no `.env.local` (que não é commitado) e nos painéis dos serviços. A pessoa que compartilhar o projeto passa os secrets via canal seguro (1Password, Bitwarden, mensagem efêmera).

---

## 1. Overview

Kinase é uma plataforma de **microlearning médico via WhatsApp**: o bot manda questões estilo residência (ABCDE ou V/F), o médico responde uma letra, recebe feedback + explicação, avalia dificuldade (F/M/D), avança em blocos de 10 questões com carry-over de erros. O painel admin permite gerenciar pacotes de questões, formulários pré/pós-teste, usuários (com grupo experimental) e ver métricas do experimento.

Contexto do experimento: **primeiro ciclo de validação de 14 dias** com 15–30 médicos R1, medindo H1–H7 (volume de estudo, fricção, dores reais, retenção, ranking, dependência de lembretes, valor percebido). Pré-teste dispara no 1º `/start`; pós-teste dispara 14 dias depois; lembretes ativos D1–7 e pausados D8–14 para medir retenção orgânica.

## 2. Stack

| Camada | Tecnologia | Onde vive |
|---|---|---|
| Frontend + API | Next.js 16 (App Router, Turbopack) | Vercel Hobby, projeto `edevs/plataforma-micro` |
| UI | shadcn/ui + Tailwind + Recharts | dentro do Next.js |
| Banco de dados | Supabase (Postgres + RLS) | projeto `nfgpwuhwdpvvgyjadbws` |
| Auth | Supabase Auth (email/senha) | dentro do Supabase |
| WhatsApp | Z-API (WhatsApp Web protocol) | instância `kinase` — https://app.z-api.io |
| Cron | Supabase pg_cron | 2 jobs disparando webhook motivacional |
| Domínio | Registro.br → Vercel | https://kinase.med.br |
| Repo | GitHub | https://github.com/contatotrapstore/Kinase |

## 3. Setup Local

### Pré-requisitos

- Node 20+
- Git
- Editor com suporte a TypeScript (VS Code recomendado)

### Clonar e instalar

```bash
git clone https://github.com/contatotrapstore/Kinase.git
cd Kinase
npm install
```

### Configurar `.env.local`

Copiar o arquivo do canal seguro compartilhado pelo dono do projeto (não está no repo). O arquivo tem as chaves:

```env
NEXT_PUBLIC_SUPABASE_URL=https://nfgpwuhwdpvvgyjadbws.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<pegar no painel Supabase — Settings/API>
SUPABASE_SERVICE_ROLE_KEY=<pegar no painel Supabase — Settings/API — service_role>

ZAPI_INSTANCE_ID=<pegar no painel Z-API — instância "kinase">
ZAPI_TOKEN=<pegar no painel Z-API>
WHATSAPP_API_TOKEN=<Client-Token do Z-API>

ADMIN_EMAIL=admin@kinase.com.br
ADMIN_PASSWORD=<pegar do dono>
```

### Rodar em dev

```bash
npm run dev
```

Aplicação sobe em http://localhost:3000. O painel admin exige login (email/senha configurados no Supabase Auth).

### Build local (validar antes de push)

```bash
./node_modules/.bin/next build
```

Deve rodar limpo. Se travar em type error, arruma antes de push (o commit-push não roda pre-checks).

## 4. Acessos por Camada

Cada serviço tem seu próprio painel + próprio esquema de convite. Todos os acessos são gratuitos no plano atual (Hobby/Free), mas exigem convite explícito do dono da conta.

### Vercel — https://vercel.com/edevs/plataforma-micro

- Onde: deploys, logs de runtime, variáveis de ambiente de produção, aliases de domínio
- Como acessar: convite do owner (`gouveiarx@...`) via Settings → Members
- CLI: `npm i -g vercel@latest && vercel login`
- Comandos úteis:
  - `vercel ls` — lista deploys
  - `vercel logs <url>` — logs de runtime
  - `vercel env pull` — baixa .env de produção pro local

### Supabase — https://supabase.com/dashboard/project/nfgpwuhwdpvvgyjadbws

- Onde: tabelas, migrations, Auth (usuários admin), Storage, Edge Functions, pg_cron, logs Postgres
- Como acessar: convite via Organization → Members
- CLI: `npm i -g supabase` (opcional pra migrations locais)
- Painéis importantes:
  - **Database → Tables**: usuarios, questoes, respostas, pacotes, formularios, formularios_respostas, block_feedback, motivacional_envios, whatsapp_log, progresso_usuario, ranking_snapshot
  - **Database → Migrations**: histórico completo de schema
  - **Database → Cron Jobs**: 2 jobs `motivacional-manha` (14 UTC) e `motivacional-tarde` (22 UTC)
  - **Authentication → Users**: admins do painel (admin@kinase.com.br)
  - **Logs**: erros Postgres em tempo real

### GitHub — https://github.com/contatotrapstore/Kinase

- Repo privado
- Convite: owner adiciona como Collaborator (branch `main` protegida ou não — checar)
- Convenção: push direto pra `main` dispara deploy automático no Vercel

### Z-API — https://app.z-api.io

- Onde: status da instância WhatsApp, QR code pra parear, teste de envio, tokens
- Como acessar: credenciais do owner ou instância compartilhada
- Instância: `kinase` (ID `3F27C949557B6320DA9C76F7F124D212`)
- Número atual do bot: **+55 61 9644-0959**
- Se cair: painel mostra "Não conectado" — clica em "Conectar" e escaneia QR no WhatsApp do número Kinase → Aparelhos Conectados

### Painel Admin — https://kinase.med.br/login

- URL: https://kinase.med.br/login
- Admin default: `admin@kinase.com.br` (senha no canal seguro)
- Criar novo admin: **Authentication → Users → Invite user** no Supabase, com o email. Depois vai no SQL Editor e roda:
  ```sql
  insert into admins (user_id, email) values ('<uuid-do-user>', 'novo@dominio.com');
  ```

## 5. Convite de Dev Novo — Checklist

Quando entrar um dev novo, dono do projeto precisa fazer nesta ordem:

- [ ] **GitHub**: convidar como Collaborator no repo `contatotrapstore/Kinase`
- [ ] **Vercel**: Settings → Members → convidar email
- [ ] **Supabase**: Organization Settings → Members → convidar email
- [ ] **Z-API**: compartilhar credenciais da instância via 1Password/Bitwarden
- [ ] **`.env.local`**: enviar arquivo ou instruir a pegar as chaves nos painéis
- [ ] **Painel admin**: criar user admin dedicado ou reusar `admin@kinase.com.br`
- [ ] **Domínio kinase.med.br**: acesso ao Registro.br opcional (só o dono geralmente)

Dev deve confirmar todos os acessos rodando:

```bash
git clone https://github.com/contatotrapstore/Kinase.git
cd Kinase && npm install
# copia .env.local
npm run dev
# abre localhost:3000/login e loga
vercel ls   # confirma acesso Vercel
```

## 6. Estrutura do Repo

```
plataforma-micro/
├── src/
│   ├── app/
│   │   ├── (admin)/          # Páginas do painel (autenticadas)
│   │   │   ├── alunos/       # Lista + adicionar/editar médicos
│   │   │   ├── bancos/       # Pacotes de questões
│   │   │   ├── dashboard/
│   │   │   ├── formularios/  # CRUD pré/pós-teste
│   │   │   ├── metricas/     # Dashboard experimental
│   │   │   ├── ranking/
│   │   │   └── upload/       # Upload de PDFs (parser)
│   │   ├── (auth)/login/
│   │   └── api/
│   │       ├── alunos/       # POST cria, PATCH atualiza grupo
│   │       ├── cron/
│   │       │   ├── keep-alive/     # Query trivial (Free Tier ativo) + job pós-envio
│   │       │   └── motivacional/   # Lembretes 2x/dia (throttle 22h)
│   │       ├── formularios/
│   │       ├── metricas/
│   │       │   └── export/         # CSV completo (1 linha/user)
│   │       ├── pdf/
│   │       │   ├── parse/          # Extração de questões
│   │       │   └── upload/         # Upload de apostilas
│   │       └── whatsapp/
│   │           ├── status/
│   │           └── webhook/        # Endpoint principal do bot (Z-API POST)
│   ├── lib/
│   │   ├── auth/require-admin.ts
│   │   ├── formularios/schema.ts   # Tipos de pergunta + validador
│   │   ├── pdf/parser.ts           # Parser de apostilas (Medcurso/Estratégia)
│   │   ├── supabase/{client,service}.ts
│   │   └── whatsapp/
│   │       ├── messages.ts         # Templates das mensagens do bot
│   │       ├── session-store.ts    # Persistência de sessão em progresso_usuario
│   │       └── zapi.ts             # Adapter Z-API
│   └── components/
│       ├── layout/sidebar.tsx
│       └── ui/                     # shadcn/ui
├── docs/DEV_ONBOARDING.md          # este arquivo
├── AGENTS.md                       # instrução pra IA sobre Next.js 16
└── package.json
```

## 7. Deploy + Rollback

### Deploy

Push pra `main` dispara build automático no Vercel:

```bash
git add <arquivos>
git commit -m "feat: descrição curta"
git push origin main
```

Build leva ~40s. Alias `kinase.med.br` aponta automaticamente pro novo Ready.

Acompanhar:
```bash
vercel ls | head -3
```

### Rollback

Se um deploy quebrar produção, promover o Ready anterior:

```bash
vercel ls    # copia URL do deploy anterior (● Ready)
vercel promote <url-do-deploy-anterior>
```

Ou pelo painel Vercel: Deployments → clica no anterior → "Promote to Production".

### Feature flags

Não temos ainda. Mudanças arriscadas devem ir em branch + PR + review antes do merge.

## 8. Runbooks — Incidentes Comuns

### Z-API caiu (bot mudo)

**Sintomas**: médicos reclamam que o bot não responde. Logs Vercel mostram `[webhook] 🚨 Z-API DESCONECTADA`.

**Confirmar**:
```bash
curl -s "https://api.z-api.io/instances/<INSTANCE_ID>/token/<TOKEN>/status" \
  -H "Client-Token: <CLIENT_TOKEN>"
# Resposta esperada quando OK: {"connected":true,"session":true,"smartphoneConnected":true}
# Se caiu: {"connected":false,"session":false,...}
```

Ou query direto no banco:
```sql
select received_at, raw_payload->>'error'
from whatsapp_log
where action = 'zapi_disconnected'
order by received_at desc limit 5;
```

**Resolver**:
1. Entrar em https://app.z-api.io → instância `kinase`
2. Se aparecer QR code, abrir WhatsApp do número (+55 61 9644-0959) → Aparelhos Conectados → Escanear
3. Confirmar `connected:true` via curl acima
4. Bot volta a responder imediatamente

### Motivacional não disparou

**Sintomas**: nenhum médico recebeu lembrete no dia esperado.

**Verificar**:
```sql
-- Jobs pg_cron ativos
select jobname, schedule, active from cron.job;

-- Últimos disparos
select sent_at, u.phone
from motivacional_envios m join usuarios u on u.id=m.usuario_id
where sent_at > now() - interval '2 days'
order by sent_at desc;
```

**Causas possíveis**:
- Z-API desconectada (ver runbook acima)
- Throttle 22h ainda ativo pra todos users (raro — só se cron rodou 2x muito perto)
- Todos users no D8–14 do experimento (pausa intencional)
- Erro no endpoint `/api/cron/motivacional` — checar Vercel logs

### Pré-teste travado ("Tipo não suportado" ou "Comando não reconhecido" inesperado)

**Sintomas**: médico responde e o bot dá erro genérico ou fica mudo no meio do formulário.

**Verificar estado**:
```sql
select phone, awaiting_form, awaiting_block_feedback
from usuarios where phone = '<phone-do-medico>';
```

Se `awaiting_form` tem campos estranhos ou está travado numa pergunta:

```sql
update usuarios
   set awaiting_form = null,
       awaiting_block_feedback = null,
       awaiting_explanation_rating = null
 where phone = '<phone-do-medico>';
```

Depois manda o médico dar `/start` de novo — vai começar do zero.

### Dashboard `/metricas` sem dados

**Sintomas**: gráficos vazios, mas há usuários respondendo.

**Verificar views**:
```sql
select * from v_metricas_uso limit 3;
select * from v_retencao limit 3;
select * from v_ultima_atividade limit 3;
```

Se view não existe ou dá erro, ver histórico de migrations no Supabase (Database → Migrations) e recriar manualmente.

### "Supabase pausou o projeto"

Free Tier pausa após 7 dias sem atividade. Cron `keep-alive` roda a cada 6h fazendo uma query trivial pra evitar isso. Se pausar mesmo assim:

1. Painel Supabase → botão "Restore project"
2. Restauração leva alguns minutos
3. Depois, checar `cron.job` — os jobs pg_cron geralmente sobrevivem, mas confirmar

## 9. Contatos

- **Dono do projeto**: Dr. Rodrigo (via WhatsApp)
- **Repo owner**: `contatotrapstore` no GitHub
- **Vercel owner**: `edevs`
- **Suporte Z-API**: https://z-api.io/suporte
- **Suporte Supabase**: https://supabase.com/support (Free Tier: só Discord)

---

**Última atualização**: julho 2026. Se algo divergir, alinhar com o dono do projeto antes de mudar.
