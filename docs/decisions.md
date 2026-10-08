# Registro de decisões (ADR leve)

Formato: contexto → decisão → consequências. Status: **Aceita** (vale até ser substituída), **Proposta** (aguarda validação do responsável), **Substituída**.

---

### D-01 — Monólito modular Next.js + Supabase

**Status:** Aceita (imposta pela especificação)
**Contexto:** MVP, equipe pequena, necessidade de RLS e auth gerenciados.
**Decisão:** Uma aplicação Next.js (App Router) organizada por domínio em `src/features/*`; Supabase para Postgres, Auth e Storage. Sem microserviços nem filas externas.
**Consequências:** Deploy simples; limites de duração de função serverless afetam PDFs pesados (ver D-16).

### D-02 — Integração com Sectra apenas manual

**Status:** Aceita
**Decisão:** Tabela genérica `referencias_externas (sistema, tipo, numero, data_documento)` + anexos. Nenhum cliente HTTP para Sectra.
**Consequências:** Quando houver documentação oficial, um adaptador poderá preencher a mesma tabela sem mudança de modelo.

### D-03 — Next.js 16 com `proxy.ts`

**Status:** Aceita
**Contexto:** Versão estável atual no registro npm é 16.x; o antigo `middleware.ts` passou a se chamar `proxy.ts`.
**Decisão:** Usar a última 16.x estável, runtime Node. `proxy.ts` apenas renova a sessão e redireciona; **não** é a camada de autorização (que fica no servidor/DAL e no banco).

### D-04 — Escrita: cadastros por RLS direto; transições só por funções transacionais

**Status:** Aceita
**Contexto:** supabase-js não oferece transações multi-statement; regras como "confirmar recebimento" mexem em várias tabelas e precisam ser atômicas. Também não se pode permitir que o cliente grave `status` livremente.
**Decisão:**

- Cadastros e campos descritivos: `insert/update` direto com JWT do usuário + RLS por permissão + **grants por coluna**.
- Transições e operações multi-tabela: funções `rpc_*` em PL/pgSQL, `security definer`, `set search_path = ''`, que derivam a empresa da linha-alvo, chamam `usuario_tem_permissao`, travam linhas (`for update`), validam a transição, gravam e auditam.
- Colunas `status`, `local_atual_id`, `responsavel_atual_id`, quantidades derivadas, `empresa_id`, `codigo` **sem** grant de UPDATE para `authenticated`.
- Trigger de guarda de transição em cada tabela com status (defesa extra, vale até para funções).
  **Consequências:** Regras críticas no banco (garantia forte, testáveis via SQL) e espelhadas em TS (UX). Teste de paridade TS × SQL obrigatório. Funções `security definer` exigem revisão cuidadosa (checklist na Fase 2).

### D-05 — FKs compostas `(empresa_id, id)` para isolamento referencial

**Status:** Aceita
**Decisão:** Toda tabela operacional tem `unique (empresa_id, id)`; filhos referenciam `(empresa_id, pai_id)`.
**Consequências:** Impossível ligar uma locação da Empresa A a um fornecedor da Empresa B, mesmo por bug em função `security definer`. Custo: índices extras, FKs mais verbosas.

### D-06 — Usuários entram por convite; sem cadastro público

**Status:** Aceita
**Decisão:** Signup público desabilitado no Supabase. ADMIN convida (service role no servidor, ação auditada), definindo papel. Desativação = `usuarios_empresa.ativo = false` (e, se não restar associação ativa, ban no Auth).
**Consequências:** Precisa de SMTP configurado em homologação/produção.

### D-07 — Storage: escrita só pelo servidor (service role isolado); leitura por RLS do usuário

**Status:** Aceita
**Contexto:** Validação binária (magic bytes, sharp), hash e nome físico só são confiáveis no servidor. Se o usuário tivesse policy de INSERT no Storage, poderia contornar a validação enviando direto à API do Storage.
**Decisão:** `storage.objects` sem policies de insert/update/delete para `authenticated`. Upload pelo Route Handler usando service role **apenas** em `lib/storage/admin.ts` (`server-only`), sempre depois de a autorização ter sido provada com o cliente do usuário. Leitura/URL assinada com o cliente do usuário (policy de select por prefixo de empresa + vínculo a `evidencias`).
**Consequências:** Service role restrita a um módulo auditável; nenhum uso para consultas comuns.

### D-08 — Server Actions + Zod como padrão de formulário

**Status:** Aceita
**Decisão:** Formulários simples usam Server Actions com `useActionState`; o fluxo multi-etapa de recebimento e de nova locação usa React Hook Form no cliente com o **mesmo** schema Zod, e cada etapa persiste rascunho no servidor via action.

### D-09 — Códigos legíveis sequenciais por empresa

**Status:** Aceita
**Decisão:** Tabela `sequencias (empresa_id, prefixo, proximo)` e função `proximo_codigo(empresa, prefixo)` com `update … returning` (lock de linha). Formato `PREFIXO-000123` (6 dígitos, cresce se necessário). Prefixos: LOC, BEM, LOT, REC, MOV, OCR, DEV, COB, REL. Locais e centros de custo usam código informado pelo usuário.
**Consequências:** O incremento participa da transação, logo rollback não deixa lacunas; o custo é serializar criações concorrentes do mesmo prefixo na mesma empresa (aceitável no volume do MVP). Código não é número fiscal.

### D-10 — Saldos calculados em visões, não em contadores soltos

**Status:** Aceita
**Decisão:** Saldo de item/locação calculado por visões a partir de bens e lotes; o lote guarda suas próprias quantidades (recebida/devolvida/dividida/baixada) protegidas por CHECK. Sem colunas "saldo" redundantes na locação.
**Consequências:** Evita divergência de cache; consultas de dashboard usam índices adequados. Reavaliar materialização se volume crescer.

### D-11 — Um lote por (recebimento, item); movimentação parcial divide o lote

**Status:** Aceita
**Contexto:** Lote precisa de um local e um responsável atuais únicos (RN-30), mas quantidades podem se espalhar.
**Decisão:** Cada recebimento de item LOTE cria um lote. Mover parte cria lote filho (`lote_origem_id`) e incrementa `quantidade_dividida` na origem.
**Consequências:** Rastreabilidade completa da origem de cada unidade; listas mostram a árvore de lotes por item.

### D-12 — Estados extras de bem: SUBSTITUIDO, BAIXADO, CANCELADO; transições a partir de DISPONIVEL

**Status:** Aceita (S-06 validada pelo responsável em 2026-10-08)
**Contexto:** A especificação exige preservar o ciclo do bem trocado, tratar extravio e cancelar recebimento, mas não define estados terminais para esses casos.
**Decisão:** `SUBSTITUIDO` (troca), `BAIXADO` (extravio indenizado), `CANCELADO` (recebimento cancelado). `DISPONIVEL` também pode ir para devolução, manutenção e extravio. Extraviado continua no saldo até resolução.

### D-13 — Ciência financeira por devolução

**Status:** Aceita (validada em 2026-10-08)
**Contexto:** "Após devolução operacional, criar pendência financeira de encerramento", mas devoluções parciais também reduzem a cobrança.
**Decisão:** Cada devolução com retirada confirmada nasce com `ciencia_financeira_em = null` (pendência no dashboard do FINANCEIRO). Quando o saldo da locação zera, `status_financeiro → ENCERRAMENTO_PENDENTE`. Nenhum dos dois encerra cobrança.

### D-14 — Alteração de locação ativa via aditivo

**Status:** Aceita
**Decisão:** Após ativação, itens só podem ser acrescentados ou ter quantidade aumentada via `rpc_aditivo_item` com motivo; nunca reduzir abaixo do recebido; cabeçalho editável com motivo obrigatório (auditoria antes/depois).

### D-15 — Reversões automáticas restritas

**Status:** Aceita (validada em 2026-10-08)
**Decisão:** `EM_DEVOLUCAO → ATIVA` apenas automaticamente quando a devolução que cobria todo o saldo é cancelada; `ENCERRAMENTO_PENDENTE → EM_COBRANCA` apenas se o saldo voltar a > 0 por cancelamento administrativo. Nenhuma reversão manual.

### D-16 — PDF com @react-pdf/renderer, assíncrono via tabela de jobs

**Status:** Aceita
**Decisão:** Job em `relatorios` (PENDENTE/PROCESSANDO/CONCLUIDO/ERRO); disparo por `after()` + worker HTTP protegido chamado por qualquer agendador (Vercel Cron, pg_cron+pg_net ou externo); `for update skip locked`; watchdog; até 3 tentativas. `sharp` para normalizar imagens. Hash dos dados impresso no PDF; hash do arquivo + HMAC no banco (o hash do próprio arquivo não pode estar dentro dele).
**Alternativa descartada:** Chromium headless (pesado em serverless, depende de binário).

### D-17 — Provisionamento de empresas por script do operador

**Status:** Aceita
**Decisão:** Sem cadastro self-service de empresas (billing fora do escopo). Script `scripts/provisionar-empresa.ts` (service role, executado manualmente) cria empresa, sequências, checklist padrão e convida o primeiro ADMIN.

### D-18 — Seed apenas em DEV/CI

**Status:** Aceita
**Decisão:** `supabase/seed.sql` só é executado por `supabase db reset` (local/CI). Deploy usa `supabase db push` (não roda seed). Script de seed de usuários recusa executar se a URL não for local, salvo `ALLOW_DEMO_SEED=homologacao`. Dados marcados `[DEMONSTRAÇÃO]` no nome e `empresas.demonstracao = true`.

### D-19 — Banco de testes: Supabase CLI no CI; Postgres local com bootstrap como alternativa

**Status:** Aceita
**Contexto:** O container de desenvolvimento atual tem binários do Docker mas o daemon não está ativo; há Postgres 16 instalado.
**Decisão:** CI usa `supabase start`. Localmente, quando Docker não estiver disponível, `npm run db:local` sobe Postgres 16 e aplica `supabase/tests/bootstrap-local.sql` (papéis e esquemas `auth`/`storage` mínimos) antes das migrations. Testes de integração que dependem da API HTTP do Storage/Auth ficam marcados e rodam só com Supabase CLI.
**Consequências:** RLS e funções testáveis em qualquer lugar; fidelidade total só no CI.

### D-20 — Rate limiting em tabela Postgres

**Status:** Aceita
**Decisão:** `limites_taxa` + função `consumir_limite(chave, max, janela)` para upload, relatórios e ações sensíveis; login usa o rate limit nativo do Supabase Auth.
**Consequências:** Sem dependência de Redis/Vercel KV; suficiente para o volume do MVP.

### D-21 — Responsável = usuário associado à empresa

**Status:** Aceita (S-03 validada em 2026-10-08)
**Decisão:** `responsavel_atual_id` referencia `usuarios_empresa (empresa_id, user_id)`. Permite aceite e escopo RESPONSAVEL_LOCAL via RLS.

### D-22 — QR Code com URL `/q/{uuid}`

**Status:** Aceita
**Decisão:** QR contém `${NEXT_PUBLIC_APP_URL}/q/{id}` (UUID v4 aleatório, sem dados do bem). A rota exige login e RLS; sem acesso → 404 indistinguível de inexistente.

### D-23 — Paginação por offset com contagem

**Status:** Aceita
**Decisão:** 25/50/100 por página, `count: 'exact'` limitado a consultas indexadas; filtros na URL (`searchParams`) validados por Zod. Busca textual com `pg_trgm`. Migrar para keyset se necessário.

### D-24 — Cache Components desligado

**Status:** Aceita (Fase 1)
**Contexto:** O template do Next 16.4 liga `cacheComponents`. Neste sistema praticamente toda tela depende da sessão e da empresa do usuário.
**Decisão:** Não habilitar `cacheComponents`/`use cache`. Toda página é dinâmica e lida no contexto do usuário.
**Consequências:** Elimina o risco de servir dado de uma empresa a outra por cache compartilhado; custo de desempenho aceitável no volume do MVP. Reavaliar apenas para conteúdo realmente público.

### D-25 — Cookies de sessão HttpOnly; sem cliente Supabase no navegador

**Status:** Aceita (Fase 1)
**Decisão:** `@supabase/ssr` configurado com `httpOnly: true`, `SameSite=Lax`, `Secure` em produção. Não há `createBrowserClient`: leituras, mutações e uploads passam pelo servidor.
**Consequências:** Um XSS não consegue ler o token de sessão. Funcionalidades realtime exigiriam rever a decisão.

### D-26 — Validação de ambiente em dois momentos

**Status:** Aceita (Fase 1)
**Decisão:** Variáveis públicas validadas no build (`next.config.ts`); todas validadas na inicialização (`instrumentation.ts`). Mensagens listam apenas os nomes das variáveis, nunca os valores.
**Consequências:** Build sem variáveis públicas falha; servidor sem segredos responde 500 com log explicativo e o health check falha (impede promoção de deploy).

### D-27 — Matriz de navegadores do E2E

**Status:** Aceita (Fase 1)
**Decisão:** Em PR, smoke em Chromium nos viewports 375/768/1280. Com `E2E_FULL=1` (antes de implantação) acrescentam-se Firefox (desktop) e WebKit (celular). Fora do CI usa-se o Chromium pré-instalado em `/opt/pw-browsers` quando existir.

### D-28 — Módulos não entregues exibem estado explícito

**Status:** Aceita (Fase 1)
**Decisão:** Rotas do menu existem desde a Fase 1 com o componente `ModuloEmConstrucao`, que informa a fase prevista e não exibe dados nem ações. Nenhum mock é apresentado como funcionalidade.

### D-29 — Fonte do sistema

**Status:** Aceita (Fase 1)
**Decisão:** Pilha de fontes do sistema operacional, sem download de fontes externas (sem dependência de Google Fonts no build, CSP `font-src 'self'`).
