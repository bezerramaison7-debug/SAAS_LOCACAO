# Arquitetura — MicroSaaS de Rastreabilidade de Locações

> Documento vivo. Decisões referenciadas como **[D-xx]** (`docs/decisions.md`). Regras como **RN-xx** (`docs/business-rules.md`).

## 1. Visão geral

Monólito modular **Next.js (App Router) + Supabase (PostgreSQL, Auth, Storage)**. Sem microserviços.

```
 Navegador (mobile-first)
   │  HTML/RSC, Server Actions (POST), fetch /api/*
   ▼
 Next.js (Node runtime) ─────────────────────────────────────────────────────────
 │ proxy.ts           → renova sessão Supabase (cookies), injeta x-request-id, headers de segurança
 │ app/(auth)         → login, recuperar senha
 │ app/(app)          → Server Components de leitura (padrão)
 │ features/*/actions → Server Actions: Zod → contexto → permissão → comando de domínio
 │ app/api/files      → upload/download de evidências (Route Handler, streaming, validação binária)
 │ app/api/reports    → solicitar/consultar/baixar relatório; /process (worker protegido por segredo)
 │ app/api/health     → saúde sem segredos
 │ lib/auth           → getContexto(): usuário verificado + empresa ativa + papel + permissões
 │ lib/db             → cliente Supabase com JWT do usuário (RLS) + x-request-id
 │ lib/storage        → única fronteira que usa service role (escrita em Storage) [D-07]
 ─────────────────────────────────────────────────────────────────────────────────
   │ PostgREST (JWT do usuário)                 │ Storage API
   ▼                                            ▼
 PostgreSQL (Supabase)                         Buckets privados
   RLS em todas as tabelas expostas              evidencias / contratos / comprovantes / relatorios
   Funções de domínio transacionais (rpc_*)      policies em storage.objects por prefixo de empresa
   Triggers: updated_at, auditoria, guarda de transição, imutabilidade
   Visões de saldo e indicadores
```

## 2. Stack (versões exatas fixadas no `package.json` na Fase 1)

| Camada             | Tecnologia                                                                                                                                 | Observação                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Runtime            | Node.js 22 LTS                                                                                                                             | `engines` no package.json                            |
| Framework          | Next.js 16.4.0 (App Router, `proxy.ts`, Turbopack), React 19.3                                                                             | Server Components por padrão                         |
| Linguagem          | TypeScript `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`                                                            | sem `any`                                            |
| UI                 | Tailwind CSS 4, componentes shadcn/ui (Radix) copiados para `components/ui`                                                                | tokens em CSS vars, tema claro/escuro                |
| Formulários        | Server Actions + Zod (validação no servidor sempre); React Hook Form só em formulários multi-etapa no cliente, reutilizando o mesmo schema | [D-08]                                               |
| Validação          | Zod 4                                                                                                                                      | schemas por domínio, compartilhados cliente/servidor |
| Banco/Auth/Storage | Supabase (Postgres 15+/17), `@supabase/supabase-js`, `@supabase/ssr`                                                                       | SSR com cookies                                      |
| Datas              | `date-fns` 4 + `@date-fns/tz`                                                                                                              | UTC no banco; fuso da empresa na UI                  |
| Dinheiro           | `numeric(14,2)` no banco; `decimal.js` (ou aritmética em centavos `bigint`) no TS                                                          | nunca `number` em cálculo                            |
| PDF                | `@react-pdf/renderer` (server) + `sharp` (normaliza WebP/HEIC→JPEG, miniaturas)                                                            | [D-16]                                               |
| QR Code            | `qrcode` (server, SVG)                                                                                                                     | só URL                                               |
| Testes             | Vitest (unit/integration/RLS), Playwright (E2E Chromium/Firefox/WebKit), `@axe-core/playwright`                                            |                                                      |
| Lint/format        | ESLint 9 (flat, `next/core-web-vitals`, `typescript-eslint` strict), Prettier                                                              |                                                      |
| Observabilidade    | logger JSON estruturado próprio + Sentry opcional (`SENTRY_DSN`)                                                                           |                                                      |
| CI                 | GitHub Actions                                                                                                                             | [§11]                                                |

### 2.1 Versões instaladas (Fase 1)

| Pacote            | Versão | Pacote                  | Versão        |
| ----------------- | ------ | ----------------------- | ------------- |
| next              | 16.4.0 | @supabase/supabase-js   | 2.117.3       |
| react / react-dom | 19.3.0 | @supabase/ssr           | 0.12.7        |
| typescript        | 5.9.3  | zod                     | 4.6.5         |
| tailwindcss       | 4.3.3  | radix-ui                | 1.7.0         |
| eslint            | 9.39.5 | lucide-react            | 1.53.0        |
| prettier          | 3.9.9  | date-fns / @date-fns/tz | 4.4.0 / 1.5.0 |
| vitest            | 5.0.3  | decimal.js              | 10.6.0        |
| @playwright/test  | 1.64.0 | @axe-core/playwright    | 4.13.0        |

Fonte de verdade: `package.json` (versões exatas, sem `^`) + `package-lock.json`.

### 2.2 Configuração e falha cedo

- `next.config.ts` valida as variáveis `NEXT_PUBLIC_*` no **build** (são embutidas no bundle).
- `src/instrumentation.ts` valida **todas** as variáveis na **inicialização** do servidor; com variável ausente, o servidor registra a lista do que falta e responde 500 a qualquer requisição (inclusive `/api/health`) [D-26].
- Cache Components desligado: toda página é renderizada por requisição no contexto do usuário [D-24].

## 3. Estrutura de pastas

```
src/
  app/
    (auth)/login, recuperar-senha, recuperar-senha/redefinir
    (app)/layout.tsx  ← exige contexto; sidebar/bottom-nav
    (app)/dashboard, locacoes, recebimentos, bens, movimentacoes, vistorias,
          devolucoes, ocorrencias, cobrancas, relatorios, configuracoes
    (app)/selecionar-empresa
    auth/confirm/route.ts      ← troca de código (recuperação de senha / convite)
    api/files/route.ts, api/files/[id]/route.ts
    api/reports/route.ts, api/reports/[id]/route.ts, api/reports/process/route.ts
    api/health/route.ts
    q/[id]/page.tsx            ← destino do QR Code (redireciona para ficha após auth)
  components/ui | forms | tables | domain
  features/<dominio>/
    schemas.ts        ← Zod (entrada de comandos e filtros)
    types.ts
    queries.ts        ← leitura (server-only), usa lib/db
    commands.ts       ← chamadas a rpc_* / writes (server-only)
    actions.ts        ← Server Actions finas: parse → contexto → autorização → command → revalidate
    rules/            ← regras puras (máquina de estado, saldo, elegibilidade) — testadas em unit
    components/       ← componentes do domínio
    __tests__/
  lib/
    env/        ← validação Zod de variáveis (falha cedo) [§10]
    supabase/   ← server.ts (JWT do usuário, RLS) / admin.ts (service role, server-only) / proxy.ts (renovação de sessão). Sem cliente no navegador [D-25]
    auth/       ← getUsuarioVerificado(), getContexto(), exigirPermissao()
    permissions/← matriz (papel → permissões), can(), testes de paridade com o banco
    db/         ← wrapper de erros do PostgREST → erros de domínio; request_id
    validation/ ← schemas comuns (uuid, dinheiro decimal, data_evento, paginação)
    storage/    ← validação binária, sha256, paths, signed URL, service role isolado
    audit/      ← helpers de auditoria de aplicação (eventos sem trigger: login, relatório)
    pdf/        ← templates e pipeline de relatório
    observability/ ← logger, request_id, métricas de duração
    format/     ← datas (fuso empresa) e moeda pt-BR
  types/database.ts ← gerado por `supabase gen types`
  styles/
supabase/
  config.toml
  migrations/   ← SQL versionado (único caminho de mudança de schema)
  seed.sql      ← só dev/test [D-18]
  tests/        ← SQL auxiliar dos testes RLS
tests/
  integration/  ← Vitest contra Postgres real (funções de domínio, storage)
  rls/          ← Vitest: matriz perfil × tabela × operação
  e2e/          ← Playwright
docs/
```

Regra: cada domínio concentra schema, queries, commands, regras, componentes e testes. `page.tsx` só compõe; nenhum "actions.ts" global; nada de `utils.ts` genérico.

## 4. Modelo de dados

### 4.1 Convenções

- `id uuid primary key default gen_random_uuid()`; `created_at timestamptz default now()`, `updated_at` (trigger), `created_by`, `updated_by` (`uuid` → `auth.users`, preenchidos por trigger com `auth.uid()`).
- Toda tabela operacional: `empresa_id uuid not null` + `unique (empresa_id, id)` para permitir **FK compostas** `(empresa_id, x_id) → x(empresa_id, id)`, impedindo vínculos entre empresas [D-05].
- Status como **enums PostgreSQL** (`create type ... as enum`).
- Dinheiro `numeric(14,2)`; quantidades `numeric(14,3)` com `check (>= 0)` (permite metros/kg); itens INDIVIDUAIS exigem quantidade inteira (check).
- Sem `DELETE` concedido ao papel `authenticated` em nenhuma tabela; arquivamento via `ativo`/status.
- Índices: `empresa_id`, todas as FKs, `status`, datas de vencimento (`termino_previsto`, `prazo`), busca (`pg_trgm` GIN em códigos, número de série, placa, número de referência, razão social/nome fantasia).

### 4.2 Diagrama textual de entidades

```
auth.users (Supabase)
  └─1:1─ perfis_usuario (user_id PK, nome, telefone)
  └─1:N─ usuarios_empresa (empresa_id, user_id, papel, ativo)   unique(empresa_id,user_id)
                 │
empresas ────────┘ (nome, documento, timezone, exige_aceite_movimentacao, limite_atraso_horas, ativo)
  ├─ privado.papel_permissoes (papel, permissao)        ← global, espelho da matriz TS (não exposto)
  ├─ privado.sequencias (empresa_id, prefixo, proximo)  ← códigos LOC/BEM/LOT/REC/MOV/OCR/DEV/COB/REL
  ├─ fornecedores (razao_social, nome_fantasia, documento, contato jsonb, ativo)
  ├─ locais (codigo, nome, tipo[OBRA|ALMOXARIFADO|ESCRITORIO|OUTRO], endereco, ativo)    unique(empresa,codigo)
  ├─ centros_custo (codigo, nome, ativo)                                                 unique(empresa,codigo)
  ├─ modelos_checklist (familia_id, nome, versao, status[RASCUNHO|PUBLICADO|ARQUIVADO])  unique(empresa,familia,versao)
  │     └─1:N─ perguntas_checklist (ordem, texto, tipo_resposta, opcoes jsonb, obrigatoria, exige_foto_se jsonb)
  ├─ categorias_bem (nome, modo_controle[INDIVIDUAL|LOTE], checklist_familia_id,
  │                  exige_numero_serie, exige_placa, exige_ident_fornecedor, unidade_padrao, ativo)
  │
  ├─ locacoes (codigo, fornecedor_id, centro_custo_id, status, status_financeiro,
  │            inicio_previsto, inicio_efetivo, termino_previsto, observacoes,
  │            encerrada_operacional_em/por, data_encerramento_financeiro, encerrada_financeiro_em/por,
  │            cancelada_em/por, motivo_cancelamento)                                    unique(empresa,codigo)
  │     ├─1:N─ referencias_externas (sistema[SECTRA|OUTRO], tipo[PEDIDO|REQUISICAO|SOLICITACAO|CONTRATO|NOTA_FISCAL|OUTRO],
  │     │                            numero, data_documento, observacao)  unique(empresa,sistema,tipo,numero)
  │     ├─1:N─ itens_locacao (categoria_id, descricao, modo_controle, quantidade_contratada, unidade,
  │     │                     valor_unitario numeric, periodicidade[DIARIA|SEMANAL|QUINZENAL|MENSAL])
  │     │        ├─1:N─ bens (codigo, identificacao_fornecedor, numero_serie, placa, status,
  │     │        │            local_atual_id, responsavel_atual_id, recebimento_id, substitui_bem_id → bens)
  │     │        └─1:N─ lotes (codigo, quantidade_recebida, quantidade_devolvida, quantidade_dividida,
  │     │                      quantidade_baixada, status, local_atual_id, responsavel_atual_id,
  │     │                      recebimento_id, lote_origem_id → lotes)
  │     ├─1:N─ recebimentos (codigo, status, data_evento, recebido_por, local_id, responsavel_id,
  │     │                    excesso_autorizado_por/em, justificativa_excesso, observacoes, cancelado_*)
  │     │        └─1:N─ itens_recebimento (item_locacao_id, bem_id?, lote_id?, quantidade, condicao, observacao)
  │     ├─1:N─ devolucoes (codigo, status, solicitada_em/por, agendada_para, agendada_por,
  │     │                  retirada_em, retirada_confirmada_por, fornecedor_recebedor, conferida_em/por,
  │     │                  comprovante_confirmado, ciencia_financeira_em/por, cancelada_*, observacoes)
  │     │        └─1:N─ itens_devolucao (item_locacao_id, bem_id?, lote_id?, quantidade_solicitada,
  │     │                                quantidade_retirada, condicao_saida, status_anterior_bem, ativo)
  │     ├─1:N─ cobrancas (codigo, competencia_inicio, competencia_fim, valor_cobrado numeric, numero_documento,
  │     │                 status, motivo_divergencia, resolucao, conferida_por/em, observacoes)
  │     └─1:N─ ocorrencias (codigo, bem_id?, lote_id?, tipo, descricao, prioridade, status, responsavel_id,
  │                         prazo, quantidade?, resolucao, resultado[ENCONTRADO|INDENIZADO|REPARADO|SUBSTITUIDO|OUTRO],
  │                         status_anterior_bem, bem_substituto_id, resolvida_*, reaberta_*)
  │
  ├─ movimentacoes (codigo, bem_id? | lote_id?, quantidade?, origem_local_id, destino_local_id,
  │                 responsavel_anterior_id, novo_responsavel_id, data_evento, motivo, status,
  │                 aceita_por/em, recusada_*, corrige_movimentacao_id, lote_destino_id)
  ├─ vistorias (tipo[ENTRADA|PERIODICA|SAIDA|OCORRENCIA], modelo_id (versão exata), bem_id? | lote_id?,
  │             evento_origem_tipo, evento_origem_id, data_evento, realizada_por, status, observacao)
  │     └─1:N─ respostas_vistoria (pergunta_id, resposta_json, observacao)
  ├─ evidencias (entidade_tipo, entidade_id, tipo[FOTO|DOCUMENTO|COMPROVANTE|CONTRATO], bucket, storage_path,
  │              nome_original, mime_type, tamanho_bytes, hash_arquivo, capturada_em, enviada_em,
  │              latitude, longitude, legenda, status[ATIVA|SUBSTITUIDA|REMOVIDA], substituida_por_id,
  │              motivo_remocao, removida_por/em, pergunta_id?)
  ├─ relatorios (codigo, tipo[LOCACAO|BEM|LOCAL|PERIODO], parametros jsonb, status, versao_template,
  │              storage_path, hash_arquivo, hash_dados, assinatura_hmac, tentativas, erro, iniciado_em, concluido_em)
  ├─ auditoria (empresa_id?, ator_id, acao, entidade_tipo, entidade_id, dados_anteriores jsonb,
  │             dados_novos jsonb, request_id, created_at)                ← append-only
  └─ privado.limites_taxa (chave, janela_inicio, contador) + privado.limites_config ← rate limit [D-20]

privado.auditoria_autenticacao (sem empresa; evento, email_hash, ip_hash, motivo) ← não exposta
privado.transicoes (maquina, de, para) ← tabela única de transições de estado
```

Exclusividade bem/lote: `check ((bem_id is null) <> (lote_id is null))` em `itens_devolucao`, `movimentacoes`, `vistorias`. Em `itens_recebimento` o lote só existe após a confirmação (D-33): `check (not (bem_id is not null and lote_id is not null))` e `bem_id ⇒ quantidade = 1`. Ocorrência pode ser sobre locação inteira (ambos nulos) — `check (not (bem_id is not null and lote_id is not null))`.

### 4.3 Constraints críticas

- `unique (empresa_id, codigo)`: locacoes, bens, lotes, locais, centros_custo, recebimentos, movimentacoes, ocorrencias, devolucoes, cobrancas, relatorios.
- `unique (empresa_id, sistema, tipo, numero)` em referencias_externas.
- Lotes: `check (quantidade_recebida >= 0 and quantidade_devolvida >= 0 and quantidade_dividida >= 0 and quantidade_baixada >= 0 and quantidade_devolvida + quantidade_dividida + quantidade_baixada <= quantidade_recebida)`.
- `itens_locacao.quantidade_contratada > 0`; `valor_unitario >= 0`; INDIVIDUAL ⇒ quantidade inteira.
- `itens_devolucao`: `quantidade_retirada <= quantidade_solicitada`; `unique (bem_id) where bem_id is not null and ativo` (RN-57).
- `cobrancas.competencia_fim >= competencia_inicio`; `valor_cobrado >= 0`.
- `locacoes.termino_previsto >= inicio_previsto`.
- `usuarios_empresa`: trigger impede desativar/rebaixar o último ADMIN ativo.
- `modelos_checklist` PUBLICADO: trigger impede update/insert em perguntas.
- `movimentacoes`, `respostas_vistoria` de vistoria concluída, `auditoria`: imutáveis (sem grant de update + trigger).

### 4.4 Migrations (Fase 2)

| Arquivo                                              | Conteúdo                                                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `20261008120000_fundacao_tipos.sql`                  | extensões, esquema `privado`, enums, tabela de transições                                   |
| `20261008120100_nucleo_multiempresa.sql`             | empresas, perfis, usuarios_empresa, papel_permissoes, funções de segurança, sequências      |
| `20261008120200_cadastros.sql`                       | fornecedores, locais, centros de custo, checklists versionados, categorias                  |
| `20261008120300_locacoes_ativos.sql`                 | locações, referências externas, itens, recebimentos, bens, lotes, itens de recebimento      |
| `20261008120400_eventos.sql`                         | vistorias, respostas, movimentações, ocorrências, devoluções, itens de devolução, cobranças |
| `20261008120500_evidencias_relatorios_auditoria.sql` | evidências, relatórios, auditoria, auditoria de autenticação, limite de taxa                |
| `20261008120600_triggers.sql`                        | autoria, códigos, guarda de transição, auditoria, imutabilidade, último ADMIN, consistência |
| `20261008120700_visoes_saldo.sql`                    | `status_bem_ativo`, `v_saldo_item_locacao`, `v_saldo_locacao` (security_invoker)            |
| `20261008120800_rls_privilegios.sql`                 | revogação dos padrões do Supabase, grants por coluna, RLS de todas as tabelas               |
| `20261008120900_storage.sql`                         | buckets privados e policies de leitura                                                      |

Seed: `supabase/seed.sql` (D-18). Tipos: `src/types/database.ts` (gerado por `npm run db:types`; o CI falha se estiver desatualizado).

## 5. Camadas de autorização (defesa em profundidade)

| Camada             | Mecanismo                                                                                                                                               | Falha esperada                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 1. Interface       | `can(contexto, permissao)` esconde/desabilita ações                                                                                                     | só UX                                 |
| 2. Servidor        | toda Server Action/Route Handler: `getContexto()` (JWT verificado via `auth.getClaims()`/`getUser()`, nunca `getSession()`) → `exigirPermissao()` → Zod | 401/403, erro tipado                  |
| 3. Banco — tabelas | RLS por operação; `usuario_pertence_empresa()`, `usuario_tem_permissao()`; grants mínimos; privilégios de coluna; FKs compostas                         | 0 linhas / `42501`                    |
| 4. Banco — funções | `rpc_*` `security definer`, `search_path = ''`, revalidam permissão e empresa a partir da linha-alvo (nunca de parâmetro)                               | exceção `P0001` com código de domínio |
| 5. Storage         | buckets privados; leitura via policy por prefixo `{empresa_id}/` + vínculo a `evidencias` visível; escrita só pelo servidor                             | 403                                   |

### 5.1 Funções de segurança (SQL) — esquema `privado` (não exposto pelo PostgREST, D-30)

```sql
usuario_pertence_empresa(p_empresa uuid) returns boolean  -- stable, security definer, search_path=''
  -- exists usuarios_empresa ue where ue.empresa_id = p_empresa and ue.user_id = (select auth.uid()) and ue.ativo
  --   and empresa ativa
usuario_papel(p_empresa uuid) returns papel_usuario
usuario_tem_permissao(p_empresa uuid, p_permissao text) returns boolean
  -- pertence ∧ exists papel_permissoes(papel, permissao)
usuario_eh_responsavel_por(p_empresa, p_entidade_tipo, p_entidade_id) returns boolean  -- escopo RESPONSAVEL_LOCAL
```

Padrões de performance: `(select auth.uid())` nas policies, índice `usuarios_empresa(user_id, empresa_id) where ativo`.

### 5.2 Padrão de escrita [D-04]

- **Cadastros simples** (fornecedores, locais, centros de custo, categorias, campos editáveis de locação em rascunho, itens em rascunho, referências externas, cobranças – campos descritivos): `insert/update` direto pelo cliente com JWT do usuário, protegido por RLS `with check usuario_tem_permissao(empresa_id, '<recurso>.gerenciar')` e **grants por coluna** (sem `empresa_id`, `status`, `codigo`, campos derivados).
- **Transições de estado e operações multi-tabela** (ativar, confirmar recebimento, movimentar, aceitar, troca, ocorrência, devolução em cada etapa, encerramentos, evidência, relatório): **somente** via `rpc_*` transacionais. Colunas `status`, `local_atual_id`, `responsavel_atual_id`, quantidades derivadas **não** têm grant de UPDATE para `authenticated`.
- Trigger `guardar_transicao_<entidade>` valida `OLD.status → NEW.status` contra a tabela de transições, inclusive para funções.

## 6. Autenticação e contexto

- Supabase Auth e-mail/senha. Cadastro público **desabilitado**; usuários entram por convite do ADMIN (`auth.admin.inviteUserByEmail` no servidor — uso justificado de service role, auditado) [D-06].
- `proxy.ts` (Next 16) renova cookies de sessão em toda requisição e redireciona rotas privadas sem sessão para `/login`. A verificação **autoritativa** acontece novamente no `(app)/layout.tsx` e em cada action/route (`lib/auth`).
- Empresa ativa: cookie `empresa_ativa` é só **preferência**; `getContexto()` confirma associação ativa no banco a cada requisição (cache por requisição com `React.cache`). Se o usuário tiver uma única associação, ela é usada; várias → `/selecionar-empresa`; nenhuma → tela "sem acesso".
- Cookies: `HttpOnly`, `Secure` em produção, `SameSite=Lax`.
- Recuperação de senha: `resetPasswordForEmail` → `/auth/confirm` (PKCE `verifyOtp`/`exchangeCodeForSession`) → `/recuperar-senha/redefinir`. Resposta sempre neutra ("se o e-mail existir...").
- Login: rate limit do próprio Supabase Auth + registro em `auditoria_autenticacao` (hash do e-mail, nunca senha).

### 6.1 Implementação (Fase 3)

| Peça                                                      | Arquivo                                                                            |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Usuário verificado (getClaims)                            | `src/lib/auth/sessao.ts`                                                           |
| Contexto (empresa ativa, papel, permissões)               | `src/lib/auth/contexto.ts` — `getEstadoAcesso()`, `exigirContexto()`               |
| Regra da empresa ativa (cookie = preferência)             | `src/lib/auth/empresa-ativa.ts`                                                    |
| Autorização no servidor                                   | `src/lib/auth/autorizacao.ts` — `pode`, `exigirPermissao`, `exigirPermissaoPagina` |
| `next` seguro e rotas públicas                            | `src/lib/auth/redirecionamento.ts`                                                 |
| Login, logout, recuperação, redefinição, troca de empresa | `src/features/auth/`                                                               |
| Usuários (convite, papel, ativação)                       | `src/features/usuarios/` + `rpc_*` (migration 011)                                 |
| Perfil e empresa                                          | `src/features/empresa/`                                                            |
| Auditoria de autenticação                                 | `src/lib/audit/autenticacao.ts` (D-40)                                             |
| Links de e-mail                                           | `src/app/auth/confirm/route.ts` + `supabase/templates/` (D-38)                     |

Fluxo de cada requisição autenticada: proxy renova cookies (sem sessão → `/login?next=`) → `(app)/layout.tsx` chama `exigirContexto()` (redireciona para `/login`, `/sem-acesso` ou `/selecionar-empresa`) → página/action verifica permissão → banco aplica RLS com o JWT.

## 7. Storage e evidências [D-07]

Fluxo de upload (`POST /api/files`, multipart, streaming com limite de bytes):

1. `getContexto()`; Zod nos metadados (`entidade_tipo`, `entidade_id`, `tipo`, `capturada_em`, `lat/long`, `legenda`, `pergunta_id?`).
2. Autorização: a entidade é lida **com o cliente do usuário** (RLS) → prova que é da empresa do contexto e visível; checa permissão de mutação sobre a entidade e estado que aceita evidência.
3. Rate limit (`limites_taxa`).
4. Validação binária: _magic bytes_ (JPEG `FF D8 FF`, PNG `89 50 4E 47`, WebP `RIFF....WEBP`, PDF `%PDF-`), extensão derivada do MIME real, tamanho, tipo permitido por contexto; PDFs com JavaScript/`/Launch` rejeitados (varredura simples) ; imagens decodificadas por `sharp` (rejeita arquivo corrompido/polyglot).
5. SHA-256 no servidor; path `{empresa_id}/{entidade_tipo}/{entidade_id}/{uuid}.{ext}`.
6. Upload com cliente **service role isolado em `lib/storage/admin.ts`** (`import 'server-only'`).
7. `rpc_registrar_evidencia` (JWT do usuário) insere a linha + auditoria; se falhar, remove o objeto (compensação). Job de limpeza de órfãos documentado.

Download (`GET /api/files/{id}`): lê `evidencias` com cliente do usuário (RLS) → se visível, `createSignedUrl` (5 min) com o cliente do usuário (policy de SELECT em `storage.objects` exige `usuario_pertence_empresa(split_part(name,'/',1)::uuid)`) → redirect 302 com `Cache-Control: no-store`. Nada é persistido.

## 8. Auditoria

Dois mecanismos complementares, ambos na mesma transação da operação:

1. **Trigger genérico** `auditar_alteracao()` em tabelas críticas (locacoes, itens_locacao, referencias_externas, recebimentos, bens, lotes, movimentacoes, ocorrencias, devolucoes, itens_devolucao, cobrancas, evidencias, usuarios_empresa, perfis_usuario, modelos_checklist, empresas): grava `INSERT/UPDATE` com `to_jsonb(OLD)`/`to_jsonb(NEW)` filtrando colunas sensíveis (lista de exclusão).
2. **Eventos semânticos** gravados pelas `rpc_*` (`acao` = `recebimento.confirmar`, `locacao.encerrar_financeiro`, `evidencia.substituir`, `relatorio.gerar`, …) com contexto adicional (justificativa, motivo).

`request_id`: o servidor envia `x-request-id` em todas as chamadas PostgREST; os triggers leem `current_setting('request.headers', true)::json->>'x-request-id'`. `ator_id = auth.uid()`.
`auditoria` é append-only: sem grants de update/delete; leitura por ADMIN, GESTOR, AUDITOR.
Login/falha de login → `auditoria_autenticacao` (não exposta via API).

Ações auditadas (mínimo): criação/alteração/ativação/cancelamento de locação; recebimento (confirmação, autorização de excesso, cancelamento); alteração de local/responsável; movimentações (criação, aceite, recusa); ocorrências (criação, tratamento, resolução, reabertura, cancelamento); troca; devoluções (cada etapa, cancelamento, ciência financeira); encerramento operacional; encerramento financeiro; cobranças; evidência (upload, substituição, remoção lógica); relatório (solicitação, geração); usuários, papéis e associações; configurações da empresa.

## 9. Relatórios PDF [D-16]

- `POST /api/reports` → valida, rate limit, cria `relatorios` `PENDENTE`, responde 202 com id. Em seguida `after()` do Next dispara o processamento (best effort).
- Worker `POST /api/reports/process` (protegido por `REPORT_SIGNING_SECRET`/cabeçalho de cron) reivindica jobs com `update … where status='PENDENTE' … for update skip locked`, marca `PROCESSANDO`, monta **snapshot** de dados (consulta única via função `relatorio_locacao_snapshot(id)`), baixa fotos do storage, normaliza com `sharp` (máx. 1600 px, JPEG), renderiza com `@react-pdf/renderer`, calcula `hash_dados` (SHA-256 do JSON canônico — impresso no rodapé) e `hash_arquivo` (SHA-256 do PDF — no banco), `assinatura_hmac` (HMAC-SHA256 com `REPORT_SIGNING_SECRET`), envia ao bucket `relatorios`, marca `CONCLUIDO`.
- Agendador externo (Vercel Cron **ou** pg_cron + `pg_net` **ou** qualquer cron HTTP) chama o worker a cada minuto para pegar pendentes/retentativas e o watchdog de `PROCESSANDO` > 10 min. Nada depende exclusivamente da Vercel.
- UI faz _polling_ de `GET /api/reports/{id}` (2–5 s) e oferece download via URL assinada.
- Limites: máx. N fotos por relatório (configurável, padrão 300); acima disso, paginação por seções.

## 10. Configuração e ambientes

`.env.example`:

```
NEXT_PUBLIC_APP_URL=                      # público
NEXT_PUBLIC_SUPABASE_URL=                 # público
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=     # público (chave publishable; RLS protege)
SUPABASE_SERVICE_ROLE_KEY=                # SECRETO — só servidor (lib/storage/admin, lib/supabase/admin)
REPORT_SIGNING_SECRET=                    # SECRETO — HMAC de relatórios e autenticação do worker
SENTRY_DSN=                               # opcional
```

`lib/env` valida com Zod: `env.client.ts` (só `NEXT_PUBLIC_*`) e `env.server.ts` (`import 'server-only'`). Ausência de obrigatória → erro na inicialização com mensagem listando as variáveis faltantes. O CI faz varredura do bundle cliente por valores/nomes secretos.

Ambientes **DEV** (Supabase CLI local), **HOMOLOGAÇÃO** e **PRODUÇÃO**: projetos Supabase distintos (banco, buckets, chaves), projetos/ambientes Vercel distintos; _preview deployments_ apontam para homologação, nunca produção. Migrations aplicadas por `supabase db push` no pipeline; seed nunca roda fora de DEV/CI [D-18].

## 11. Observabilidade

- `request_id` (UUID) gerado no `proxy.ts` (ou recebido de `x-request-id` confiável), propagado para logs, PostgREST e auditoria; devolvido no header de resposta e exibido em mensagens de erro ("código de suporte").
- Logger JSON: `{ts, level, request_id, modulo, operacao, empresa_id?, user_id?, duracao_ms, erro_codigo}`; lista de chaves proibidas (senha, token, authorization, cookie, key, secret) com redaction automática.
- Métricas mínimas por log: duração e erro de upload, geração de PDF, falhas de autorização (403/42501), jobs.
- `GET /api/health`: status da app e ping do banco; sem versão de dependências ou variáveis.
- Sentry opcional (sem PII: `sendDefaultPii: false`).

## 12. Segurança adicional

- Headers: CSP (com nonce para scripts), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(self), geolocation=(self)`, `frame-ancestors 'none'`, HSTS em produção.
- Server Actions: `bodySizeLimit` baixo (1 MB); uploads apenas pelo Route Handler com limite de streaming.
- Rate limit em upload, geração de relatório e ações sensíveis via tabela `limites_taxa` (sem dependência de Redis/KV) [D-20].
- `npm audit --audit-level=high` no CI; Dependabot.
- Backup: PITR/backups diários do Supabase (plano), procedimento de restore documentado e testado na Fase 9; retenção de evidências documentada (padrão: enquanto a empresa existir + 5 anos após encerramento da locação — **a validar**).

## 13. Pipeline CI/CD (GitHub Actions)

1. `npm ci` (falha se lockfile divergir) → 2. `prettier --check` → 3. `eslint` → 4. `tsc --noEmit` → 5. `vitest run` (unit) → 6. `supabase start` + `supabase db reset` (migrations + seed de teste) → 7. `test:integration` → 8. `test:rls` → 9. `next build` + varredura de segredos no bundle → 10. Playwright smoke (Chromium) em PR / suíte completa 3 navegadores na `main` → 11. deploy homologação (`supabase db push` + Vercel) → 12. aprovação manual (GitHub Environment protegido) → 13. produção.

## 14. Estratégia de testes

| Nível      | Ferramenta                                                                          | Alvo                                                                                                                       |
| ---------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Unit       | Vitest                                                                              | máquinas de estado, saldo, elegibilidade de encerramento, matriz de permissões, schemas Zod, datas/fuso, moeda, estimativa |
| Paridade   | Vitest                                                                              | matriz TS × `papel_permissoes`; transições TS × função SQL                                                                 |
| Integração | Vitest + Postgres real (Supabase local)                                             | cada `rpc_*`, storage, auditoria na mesma transação                                                                        |
| RLS        | Vitest + clientes com JWT por perfil (anon, cada papel de A, usuário de B, inativo) | SELECT/INSERT/UPDATE/"cancelar" por tabela crítica                                                                         |
| E2E        | Playwright (375/768/1280; Chromium/Firefox/WebKit)                                  | 16 cenários da especificação + axe                                                                                         |

Implementação (Fase 2): `tests/support/db.ts` executa cada teste numa transação **sempre revertida**, com `set local role anon|authenticated|service_role` e `request.jwt.claims` — o mesmo mecanismo do PostgREST — sobre o banco seedado. Suites: `tests/rls/` (estrutura, isolamento A×B, atores, storage) e `tests/integration/` (paridade TS×SQL, integridade, triggers/auditoria, saldo, seed) [D-32].

Ambiente de testes de banco: **Supabase CLI** (`supabase start`, requer Docker). Alternativa quando Docker não estiver disponível (como no container de desenvolvimento atual): Postgres 16 local + script `supabase/tests/bootstrap-local.sql` que cria papéis `anon/authenticated/service_role`, esquema `auth` mínimo (`auth.uid()`, `auth.jwt()`, `auth.users`) e `storage` mínimo, suficiente para testes de RLS/integração SQL. O CI usa sempre o Supabase CLI real [D-19].
