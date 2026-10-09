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

### D-30 — Esquema `privado` para funções e tabelas internas

**Status:** Aceita (Fase 2)
**Decisão:** Funções de segurança/trigger e tabelas internas (`transicoes`, `papel_permissoes`, `sequencias`, `limites_*`, `auditoria_autenticacao`) ficam em `privado`, que não é exposto pelo PostgREST. `authenticated` tem apenas USAGE e EXECUTE nas funções usadas por policies. `public.usuario_pertence_empresa` existe como wrapper exigido pela especificação. Revogação de EXECUTE para PUBLIC é feita explicitamente e no padrão **global** (privilégios padrão por esquema só acrescentam).

### D-31 — DELETE apenas de linhas de rascunho

**Status:** Aceita (Fase 2)
**Decisão:** `authenticated` só tem DELETE em linhas-filhas enquanto o documento-pai está em rascunho: referências externas e itens (locação RASCUNHO), perguntas (checklist RASCUNHO), itens de recebimento, respostas de vistoria e itens de devolução (pai RASCUNHO). Registros operacionais nunca são apagados; a auditoria registra inclusive essas exclusões de rascunho.

### D-32 — Testes de RLS/integração simulando o PostgREST em SQL

**Status:** Aceita (Fase 2)
**Decisão:** Testes conectam via `pg`, abrem transação, aplicam `set local role` e `request.jwt.claims` e sempre fazem rollback. Assim rodam tanto no Postgres local com camada de compatibilidade (sem Docker) quanto no Supabase CLI do CI, sem depender da API HTTP. Testes da API HTTP do Storage/Auth entram nas fases 3 e 5.

### D-33 — Lote criado na confirmação do recebimento

**Status:** Aceita (Fase 2)
**Decisão:** Durante o rascunho, itens de LOTE têm apenas quantidade em `itens_recebimento`; o lote (com local/responsável obrigatórios) nasce na confirmação transacional e é vinculado (`lote_id`). Bens individuais nascem no rascunho como `AGUARDANDO_RECEBIMENTO` (permite fotografar a identificação antes de confirmar).

### D-34 — Health: vivacidade × prontidão

**Status:** Aceita (Fase 2)
**Decisão:** `/api/health` responde vivacidade; `/api/health?profundo=1` verifica o Supabase pelo endpoint público de saúde do Auth (503 se indisponível), sem expor detalhes nem usar service role.

### D-35 — Integridade entre tabelas por triggers de leitura (security definer)

**Status:** Aceita (Fase 2)
**Decisão:** Regras que cruzam tabelas e não cabem em FK (modo de controle do item, mesma locação, alvo da ocorrência, modelo publicado, entidade da evidência) são validadas por triggers `security definer` que apenas leem — para que a RLS de quem grava não produza falso negativo. Fluxos (confirmar, devolver, encerrar) continuam nas funções de domínio.

### D-36 — Stack Supabase local sem Docker (GoTrue + PostgREST + Mailpit)

**Status:** Aceita (Fase 3)
**Contexto:** O ambiente de desenvolvimento em nuvem não tem daemon Docker, mas alcança o registro do Docker Hub. E2E de autenticação exige o Supabase Auth real.
**Decisão:** `scripts/stack/` extrai das imagens oficiais (pelo protocolo de registro, sem Docker) os binários nas MESMAS versões fixadas pelo Supabase CLI 2.120 (`supabase/gotrue:v2.197.0`, `postgrest/postgrest:v16.4`, `axllent/mailpit:v1.31.3`) e os executa sobre o Postgres local; um gateway Node (porta 54321) substitui o Kong. Chaves anon/service_role derivadas do segredo de DEMONSTRAÇÃO público do Supabase local. O esquema `auth` vem das migrations do próprio GoTrue. CI continua usando `supabase start` (Docker).
**Consequências:** E2E reais (login, recuperação, convite) rodam localmente sem mocks. Storage API ainda não faz parte da stack (necessária na Fase 5).

### D-37 — Página sem permissão responde "não encontrada"

**Status:** Aceita (Fase 3)
**Decisão:** Páginas protegidas chamam `notFound()` quando falta permissão (indistinguível de inexistente; `forbidden()` ainda é experimental no Next 16.4). Com `loading.tsx` (streaming), o status HTTP fica 200 com o conteúdo de 404 e `noindex`; nenhum dado protegido é enviado. Server Actions devolvem erro tipado; o banco revalida tudo.

### D-38 — Links de e-mail com token_hash e recuperação sem PKCE

**Status:** Aceita (Fase 3)
**Decisão:** Modelos de e-mail (`supabase/templates/`) apontam para `/auth/confirm?token_hash=…&type=…`, verificado no servidor com `verifyOtp`. O pedido de recuperação usa um cliente sem sessão em fluxo implícito, para que o link funcione em qualquer navegador (o PKCE do cliente SSR exigiria o mesmo navegador). Convites usam `auth.admin.inviteUserByEmail` (service role) e a associação à empresa é feita por `rpc_vincular_usuario` com o JWT do ADMIN.

### D-39 — Redirecionamentos pela URL canônica da aplicação

**Status:** Aceita (Fase 3)
**Decisão:** Redirecionamentos do proxy e de `/auth/confirm` usam `NEXT_PUBLIC_APP_URL`, nunca o Host da requisição: o cookie de sessão pertence ao host canônico (evita perder a sessão entre `localhost` e `127.0.0.1`) e o redirecionamento não pode ser influenciado por cabeçalho Host forjado. Parâmetro `next` validado por `destinoSeguro` (sem open redirect).

### D-40 — Auditoria de autenticação pseudonimizada

**Status:** Aceita (Fase 3)
**Decisão:** Login (sucesso/falha), logout, pedido e redefinição de senha são gravados em `privado.auditoria_autenticacao` via `public.registrar_evento_autenticacao` (EXECUTE só para service_role). E-mail e IP só como HMAC-SHA256 com chave derivada de `REPORT_SIGNING_SECRET`; nunca senha ou token. Falha ao auditar não bloqueia o login, mas é logada.

### D-41 — Vínculo manual com o Sectra

**Status:** Aceita (Fase 4)
**Decisão:** Não existe integração com o Sectra. Compras digita os números (pedido, requisição, solicitação, contrato, NF) em `referencias_externas`; o mesmo documento só pode pertencer a uma locação da empresa (S-02, `unique (empresa_id, sistema, tipo, numero)`), e o pedido de compra do Sectra é obrigatório para ativar. Referências podem ser acrescentadas em locação ativa/em devolução; só são removidas no rascunho.

### D-42 — Locação em etapas com rascunho no servidor

**Status:** Aceita (Fase 4)
**Decisão:** A identificação cria a locação em `RASCUNHO` (código gerado pelo banco); as demais etapas são `/locacoes/{id}/editar?etapa=…` (referências, itens, vigência, revisão), cada uma salva no servidor. Nada fica só no navegador. Fora do rascunho a edição redireciona ao detalhe; ativação e cancelamento só por `rpc_ativar_locacao`/`rpc_cancelar_locacao` (pendências calculadas por `pendencias_ativacao_locacao`, a mesma função usada na tela de revisão).

### D-43 — Transporte de valores decimais

**Status:** Aceita (Fase 4)
**Decisão:** Leitura de `numeric` sempre com `::text` no select (sem passar por `number`). Entrada em pt-BR (`1.234,56`, `10,5`) convertida por `parseMoedaBR`/`parseQuantidadeBR` para string decimal; o envio ao PostgREST usa `decimalParaJson`, que recusa qualquer valor cuja conversão para número JSON não seja exata (limites de `numeric(14,2)`/`numeric(14,3)` validados antes). Colunas preenchidas por trigger (`codigo`, `modo_controle`) são omitidas no tipo de inserção por `insercaoComGerados` em um único ponto.

### D-44 — Busca de locações por função SQL com RLS de quem consulta

**Status:** Aceita (Fase 4)
**Decisão:** `public.buscar_locacoes` (`security invoker`, `stable`) filtra por termo (código, referência, fornecedor, bem, lote), situação, fornecedor, centro de custo, local atual dos bens, período e término, com paginação (máx. 100) e total por `count(*) over ()`. Filtros vivem na URL (GET, compartilháveis, sem JS); valores inválidos voltam ao padrão. O termo é tratado como literal (curingas do ILIKE escapados). Termo "vence em até N dias" considera só ATIVA/EM_DEVOLUCAO quando não há filtro de situação.

### D-45 — Detalhe com abas por URL e por permissão

**Status:** Aceita (Fase 4)
**Decisão:** Abas são links `?aba=…` (sem estado no cliente). Itens, bens/lotes, movimentações e cobranças exigem `valores.ver` (a RLS de `itens_locacao`/`cobrancas` já exige); recebimentos, documentos e devoluções `dados.ler_geral`; histórico `auditoria.ler` (auditoria da locação e dos filhos por `locacao_id` no snapshot). Aba pedida sem permissão volta ao Resumo. Ações aparecem só quando executáveis (nenhum botão sem ação).

### D-46 — Aditivo e anexo de contrato adiados (P1)

**Status:** Aceita (Fase 4)
**Decisão:** F4.7 (aditivo de itens em locação ativa, D-14) e F4.8 (anexo de contrato/pedido) não entram no gate da Fase 4. O anexo depende da Storage API (Fase 5); o aditivo exige `rpc_aditivo_item` com motivo. Ambos ficam registrados como pendências; a aba "Documentos" já lista anexos da locação quando existirem.

### D-47 — Vistoria de entrada sobre a linha do recebimento

**Status:** Aceita (Fase 5)
**Contexto:** O lote só nasce na confirmação (D-33), mas o checklist de entrada precisa ser feito antes dela (RN-22, RN-83).
**Decisão:** `vistorias.item_recebimento_id` identifica a linha durante o rascunho; `rpc_iniciar_vistoria_entrada` congela a versão PUBLICADA vigente da família da categoria (RN-81). A confirmação valida respostas obrigatórias e fotos exigidas, vincula cada vistoria ao bem/lote criado e a conclui na mesma transação. Vistorias só são criadas por função de domínio (INSERT revogado do cliente); respostas são gravadas por `rpc_salvar_respostas_vistoria` e validadas por tipo em trigger.

### D-48 — Excesso: autorização que confirma

**Status:** Aceita (Fase 5)
**Decisão:** Confirmar com quantidade acima do contratado leva o recebimento a `AGUARDANDO_AUTORIZACAO` (bloqueado para edição). Quem tem `recebimento.autorizar_excesso` autoriza com justificativa (≥ 10) e a própria autorização efetiva o recebimento, abrindo ocorrência `DIVERGENCIA_QUANTIDADE` por item. A Operação pode devolver ao rascunho para corrigir (`rpc_reabrir_recebimento`), o que invalida a solicitação. Item avariado exige foto e abre ocorrência `AVARIA`.

### D-49 — Envio e leitura de evidências

**Status:** Aceita (Fase 5)
**Decisão:** `POST /api/files` (route handler): origem conferida contra `NEXT_PUBLIC_APP_URL` (CSRF — rotas de API não têm a proteção das Server Actions), tamanho pelo `Content-Length`, limite por usuário (`evidencia.upload`), autorização prévia no banco com o JWT do usuário (`rpc_preparar_evidencia`, que também devolve os limites da empresa), tipo por _magic bytes_, PDF com conteúdo ativo recusado, SHA-256, caminho RN-91 gerado no servidor, gravação no bucket privado com service role (única escrita permitida no Storage) e registro com o JWT do usuário (`rpc_registrar_evidencia`/`rpc_substituir_evidencia`); falha no registro remove o objeto. `GET /api/files/{id}` lê a evidência pela RLS e redireciona (302, `no-store`, `no-referrer`) para URL assinada de 5 minutos gerada com o cliente do usuário. Remoção e substituição são lógicas (RN-95).

### D-50 — Fluxo mobile em 6 telas

**Status:** Aceita (Fase 5)
**Decisão:** Os 10 passos do fluxo (locação → itens → quantidade/bens → identificação → condição → fotos → checklist → local → responsável → revisão/confirmação) foram agrupados em 6 telas com URL própria (`?etapa=`): locação (criação), itens e identificação (inclui condição), fotos, checklist, local e responsável (com data do fato), revisão. Cada passo grava no servidor; a revisão mostra as pendências calculadas pelo banco (`pendencias_recebimento`) e o excesso (`excesso_recebimento`).

### D-51 — Storage API na stack local

**Status:** Aceita (Fase 5)
**Decisão:** `supabase/storage-api:v1.79.36` (versão do Supabase CLI) é extraída da imagem e executada com o Node musl da própria imagem pelo carregador musl dela, para que os módulos nativos correspondam. O esquema `storage` vem das migrations oficiais da Storage API (antes das migrations da aplicação, como no Supabase real); o shim de storage ficou separado para os testes de banco sem a stack. O extrator espera e repete em HTTP 429 (limite de pulls anônimos do Docker Hub).

### D-52 — `upgrade-insecure-requests` só com Supabase em HTTPS

**Status:** Aceita (Fase 5)
**Contexto:** Em build de produção com Supabase local em http, a diretiva fazia o navegador promover as URLs assinadas para https e a CSP bloqueava as fotos.
**Decisão:** A diretiva é emitida apenas quando `NEXT_PUBLIC_SUPABASE_URL` é https (homologação/produção). O E2E verifica que a miniatura é efetivamente decodificada.

### D-53 — Pré-condições de E2E gravadas no banco local

**Status:** Aceita (Fase 5)
**Decisão:** Testes E2E que dependem de quantidades contratadas criam a própria locação ativa diretamente no banco local (`tests/e2e/support/dados.ts`, recusa banco não local); todo o fluxo sob teste continua pela interface. Evita que dados acumulados entre execuções mudem o resultado (ex.: excesso).

### D-54 — Movimentação de bem e de lote

**Status:** Aceita (Fase 6)
**Decisão:** `rpc_registrar_movimentacao` é a única forma de mudar local/responsável. Bem DISPONIVEL passa a EM_USO ao ser movimentado. Lote: sem quantidade (ou com o saldo inteiro) o lote todo muda; quantidade parcial cria um lote filho no destino (`lote_origem_id`), soma `quantidade_dividida` na origem e a linha do tempo do filho começa com "Criado por divisão do lote …". Movimentações confirmadas nunca são editadas: a correção é um novo evento ligado ao anterior (`corrige_movimentacao_id`).

### D-55 — Aceite da transferência

**Status:** Aceita (Fase 6)
**Decisão:** Quando a empresa exige aceite (`exige_aceite_movimentacao`) e o responsável muda para outra pessoa, a movimentação fica `PENDENTE_ACEITE`, o bem fica EM_TRANSFERENCIA e local/responsável continuam os da origem. Só o destinatário aceita; ADMIN pode registrar aceite administrativo com justificativa (≥ 10), marcado na linha do tempo. Recusa exige motivo e devolve o bem à situação anterior; o autor ou ADMIN pode cancelar enquanto pendente. Pendência bloqueia nova movimentação, troca e é cancelada por extravio.

### D-56 — Ordem cronológica dos eventos

**Status:** Aceita (Fase 6)
**Decisão:** A data do fato não pode estar no futuro nem ser anterior ao último evento confirmado do item (recebimento, divisão ou movimentação). Fatos no mesmo minuto (precisão do formulário) são ordenados pelo momento de registro: `linha_do_tempo` devolve `registrado_em` e ordena por data do fato e depois por registro. Invariante coberta por teste: local/responsável atuais = último evento confirmado.

### D-57 — Ocorrências com efeito no estado

**Status:** Aceita (Fase 6)
**Decisão:** Extravio leva o bem a EXTRAVIADO (lote: quantidade extraviada reservada); defeito/avaria com "enviar para manutenção" leva a EM_MANUTENCAO. O status anterior é guardado na ocorrência; resolver ou cancelar restaura. Extravio só se resolve como ENCONTRADO (volta) ou INDENIZADO (bem BAIXADO; lote soma `quantidade_baixada`). Reabertura só para ocorrências sem efeito de estado (não troca/extravio). Prazo vencido = "vencida" (calculado na leitura). FINANCEIRO registra apenas divergência documental. Tratar/resolver/cancelar: ADMIN e OPERACAO.

### D-58 — QR Code e etiqueta

**Status:** Aceita (Fase 6)
**Decisão:** O QR contém só `{NEXT_PUBLIC_APP_URL}/q/{id}` (nenhum dado do ativo). `/q/{id}` exige sessão (o proxy leva ao login com retorno) e resolve o id para bem ou lote da empresa ativa pela RLS; fora do escopo → 404. A etiqueta (`/etiquetas/{bem|lote}/{id}`) fica fora do layout do app para imprimir apenas o cartão; o SVG é gerado no servidor (`qrcode` 1.5.4) e servido como data URI (permitido por `img-src data:`), sem HTML injetado.

### D-59 — Troca pelo fornecedor

**Status:** Aceita (Fase 6)
**Decisão:** `rpc_trocar_bem` cria o novo bem (`substitui_bem_id`) herdando local e responsável do antigo, encerra o antigo como SUBSTITUIDO, registra ocorrência TROCA já resolvida e abre vistoria de ENTRADA em rascunho para o novo bem (concluída na página da vistoria). O histórico do antigo permanece intacto; o novo mostra "Entrou em substituição".

### D-60 — Vistoria periódica, AUDITOR e "meus itens"

**Status:** Aceita (Fase 6)
**Decisão:** Vistorias avulsas são apenas PERIODICA (`rpc_iniciar_vistoria`), usando a versão vigente do checklist da categoria; são respondidas e concluídas em `/vistorias/{id}` (`rpc_concluir_vistoria` valida as mesmas pendências da entrada, inclusive fotos exigidas). AUDITOR não pode ser responsável por bens (somente leitura). "Só meus itens" em `/bens` filtra pelo responsável atual = usuário logado.

### D-61 — Aceite no E2E usa a empresa B

**Status:** Aceita (Fase 6)
**Decisão:** O seed já configura a Empresa B exigindo aceite e a A sem aceite. O E2E testa cada modo na sua empresa, sem alternar a configuração (os três tamanhos de tela rodam em paralelo). Os ativos de cada teste são criados no banco local (`criarAtivosRecebidos`, como D-53).

### D-62 — Devolução só por funções de domínio

**Status:** Aceita (Fase 7)
**Decisão:** INSERT/UPDATE/DELETE diretos em `devolucoes` e `itens_devolucao` foram revogados; tudo passa por `rpc_*` (estado, saldo e reservas na mesma transação, com a locação travada). A solicitação já nasce SOLICITADA (o rascunho não é exposto na interface). "Retirada imediata" registra o agendamento com a data da retirada no mesmo passo, preservando as duas etapas (§4.9).

### D-63 — Vistoria de saída por item

**Status:** Aceita (Fase 7)
**Decisão:** `vistorias.item_devolucao_id` liga a vistoria SAIDA ao item da devolução (uma ativa por item). Quando a categoria tem checklist, a retirada de quantidade > 0 exige a vistoria concluída (mesmas pendências da entrada, inclusive fotos). Item com quantidade 0 não precisa de vistoria; a vistoria em rascunho é cancelada.

### D-64 — Desmobilização automática e reversão (D-15)

**Status:** Aceita (Fase 7)
**Decisão:** Quando as devoluções abertas cobrem todo o saldo (todo bem ativo solicitado e todo lote reservado), a locação ATIVA passa a EM_DEVOLUCAO e guarda a devolução causadora (`desmobilizacao_devolucao_id`). Cancelar essa devolução volta a locação a ATIVA se nenhuma outra devolução aberta cobrir o saldo. Desmobilização manual (`rpc_iniciar_desmobilizacao`) não é revertida automaticamente. Retirada que zera o saldo de locação ATIVA também a leva a EM_DEVOLUCAO.

### D-65 — Retirada parcial e itens que não saem

**Status:** Aceita (Fase 7)
**Decisão:** Toda linha ativa precisa de quantidade retirada explícita (0 a solicitada). Quantidade 0 libera o item (bem volta ao estado anterior; reserva do lote liberada). Bem extraviado durante a devolução não pode ser retirado; ao liberar o item, o "estado anterior" da ocorrência de extravio é corrigido para o estado anterior real. Confirmar com tudo zero é recusado (cancele a devolução).

### D-66 — Comprovante e conferência

**Status:** Aceita (Fase 7)
**Decisão:** Comprovante (bucket `comprovantes`) só pode ser anexado à devolução com retirada confirmada. A conferência exige comprovante ativo e marca `comprovante_confirmado`. Devoluções retiradas sem comprovante aparecem em "Sem comprovante" (evidências pendentes).

### D-67 — Encerramentos independentes

**Status:** Aceita (Fase 7)
**Decisão:** Operacional (`rpc_encerrar_operacional`, ADMIN/OPERACAO): exige EM_DEVOLUCAO, nenhum bem ativo, saldo de lotes zero e nenhuma devolução aguardando retirada (`pendencias_encerramento_operacional` mostra o motivo). Financeiro (`rpc_encerrar_financeiro`, ADMIN/FINANCEIRO): exige ENCERRAMENTO_PENDENTE, data não futura (fuso da empresa) e não anterior ao início efetivo, e nenhuma cobrança PENDENTE/DIVERGENTE. Funções, permissões, campos e auditoria distintos; nenhuma chama a outra. Locação com encerramento financeiro congela as cobranças.

### D-68 — Estimativa de cobrança

**Status:** Aceita (Fase 7)
**Decisão:** `estimativa_locacao` calcula no banco (numeric) unidades × dias de posse no período por item: conta o dia em que a posse começa (recebimento ou troca) e não o dia em que termina (retirada, troca ou indenização); valor ÷ 1/7/15/30 conforme a periodicidade (S-04). Exige `cobranca.ver_estimativa`. A tela sempre exibe o aviso de RN-72 e a regra.

### D-69 — Cobranças

**Status:** Aceita (Fase 7)
**Decisão:** Registro e transições só por função (ADMIN/FINANCEIRO): PENDENTE→CONFERIDA; PENDENTE|CONFERIDA→DIVERGENTE (motivo ≥ 10); DIVERGENTE→RESOLVIDA (resolução ≥ 10, imutável depois). A primeira cobrança leva NAO_INICIADO→EM_COBRANCA (RN-74); com o saldo zerado o status continua ENCERRAMENTO_PENDENTE. Valor com 2 casas, competência com fim ≥ início. Documento anexado como evidência DOCUMENTO da cobrança.

### D-70 — Envio de arquivo só após a hidratação

**Status:** Aceita (Fase 7)
**Contexto:** A falha intermitente da Fase 6 ("Arquivo enviado." não aparecia) foi reproduzida: um arquivo escolhido antes da hidratação era ignorado sem aviso, porque o `onChange` do React ainda não existia.
**Decisão:** Campos controlados pelo React (envio de arquivo, tipo de ocorrência, categoria/unidade do item, tipo/opções/regra de foto da pergunta) ficam desabilitados até a hidratação (`useHidratado`, via `useSyncExternalStore`): antes dela, um arquivo escolhido era ignorado e um tipo de ocorrência escolhido era revertido pelo React. Os testes E2E usam `anexar()`, que espera o campo habilitado (seleção e digitação já esperam por padrão).
