# Estado atual do projeto

## Fase atual

**Fase 2 — Banco e segurança: CONCLUÍDA, aguardando autorização para a Fase 3 (Autenticação e usuários).**

## Última tarefa concluída

Schema completo com migrations versionadas, constraints, índices, triggers, RLS em todas as tabelas, privilégios por coluna, storage privado, seed de demonstração idempotente, paridade TS×SQL e suíte de testes de isolamento multiempresa.

## Funcionalidades concluídas

**Fase 1 (fundação):** ver histórico do git — Next.js 16.4, TS strict, design system, layout responsivo, tema, env, proxy/CSP, observabilidade, CI.

**Fase 2 (banco e segurança):**

- 10 migrations (`supabase/migrations/`): 26 tabelas em `public`, esquema interno `privado`, 27 enums, visões de saldo.
- Multiempresa: `empresa_id` em todas as tabelas operacionais + FKs compostas `(empresa_id, id)` (impossível vincular registros de empresas diferentes, mesmo como superusuário).
- Segurança: RLS em todas as tabelas; `anon` sem nenhum privilégio; `authenticated` com SELECT + INSERT/UPDATE só em colunas editáveis; DELETE só em linhas de rascunho; status, local/responsável atuais, quantidades, códigos e autoria nunca graváveis diretamente.
- Funções: `privado.usuario_pertence_empresa` (+ wrapper público), `usuario_tem_permissao`, `pode_ler`, escopo do responsável local (`ve_bem`, `ve_lote`, `ve_locacao_por_item`, `ve_entidade`), `proximo_codigo`, `consumir_limite_taxa`.
- Triggers: autoria/updated_at, `empresa_id` e `codigo` imutáveis, códigos LOC/BEM/LOT/REC/MOV/OCR/DEV/COB/REL, guarda de transição de estado (12 máquinas), auditoria append-only na mesma transação (com `request_id` e ator), imutabilidade de registros finalizados (movimentação, vistoria, relatório, checklist publicado, conteúdo da evidência), último ADMIN ativo, consistência entre tabelas.
- Storage: buckets privados `evidencias`, `contratos`, `comprovantes`, `relatorios`; leitura apenas de objetos vinculados a evidência/relatório visível; nenhuma escrita por usuário.
- Matriz de permissões (`src/lib/permissions/matriz.ts`) e máquinas de estado (`src/features/*/rules/maquina-estado.ts`) espelhadas no banco, com testes de paridade.
- Seed de demonstração (Empresa A e B, 11 usuários de todos os perfis, rascunho, ativa com recebimento parcial, em devolução, bens, lote, vistorias, movimentação, ocorrência vencida, cobrança), bloqueado em produção.
- Tipos do banco gerados (`src/types/database.ts`) e usados pelos clientes Supabase.
- `/api/health?profundo=1` (prontidão do Supabase).
- Banco local sem Docker: `scripts/db/local-pg.sh`, `scripts/db/reset-local.sh`, `supabase/tests/bootstrap-local.sql`.
- CI: job `banco` (Supabase CLI) com migrations + seed, integração, RLS e verificação de tipos.

## Funcionalidades parciais

- Telas de módulos ainda exibem "disponível a partir da Fase N" (D-28).
- Sem autenticação na interface (Fase 3). Funções administrativas de usuários (convite, papel, ativação) previstas para a Fase 3.
- Funções de domínio transacionais (`rpc_*`: ativar locação, confirmar recebimento, movimentar, devolver, encerrar) previstas nas fases 4–8; a estrutura de banco que elas usam já existe e está protegida.

## Próximas tarefas

Fase 3 — login/logout/recuperação de senha, SSR auth, contexto de empresa (`getContexto`), `exigirPermissao`, administração de usuários, auditoria de autenticação, E2E de perfil e de acesso cruzado.

## Bugs conhecidos

Nenhum.

## Decisões tomadas

D-01 a D-35 em `docs/decisions.md`. Novas nesta fase: D-30 (esquema `privado`), D-31 (DELETE só em rascunho), D-32 (testes simulando PostgREST), D-33 (lote nasce na confirmação), D-34 (health vivacidade/prontidão), D-35 (triggers de consistência `security definer`).

## Migrations aplicadas

`20261008120000_fundacao_tipos` → `20261008120900_storage` (10 arquivos; ver `docs/architecture.md §4.4`). Aplicadas localmente via `scripts/db/reset-local.sh` em Postgres 16; no CI via `supabase db reset` (Postgres 17).

## Variáveis/configurações necessárias

- `.env.example` / README. Testes de banco: `TEST_DATABASE_URL` (padrão `postgresql://postgres:postgres@127.0.0.1:54322/postgres`).
- Produção: `alter database postgres set app.ambiente = 'producao'` (bloqueia o seed).
- `supabase/config.toml`: cadastro público desabilitado, senha mínima de 10 caracteres com maiúsculas/minúsculas/dígitos.

## Arquivos importantes

- `supabase/migrations/*.sql`, `supabase/seed.sql`, `supabase/config.toml`, `supabase/tests/bootstrap-local.sql`.
- `src/lib/permissions/matriz.ts`, `src/lib/domain/maquina-estado.ts`, `src/lib/domain/maquinas.ts`, `src/features/*/rules/maquina-estado.ts`.
- `src/types/database.ts` (gerado).
- `tests/support/{db,fixtures,global-setup}.ts`, `tests/rls/*.test.ts`, `tests/integration/*.test.ts`.
- `scripts/db/*.sh`.

## Testes atualmente passando

- Unit: 137 (13 arquivos).
- Integração: 59 (4 arquivos: paridade, integridade, triggers/auditoria, saldo/seed).
- RLS: 235 (4 arquivos: estrutura, isolamento entre empresas, atores, storage).
- E2E (Chromium 375/768/1280): 49 passando, 5 pulados por aplicabilidade de viewport.

## Testes atualmente falhando

Nenhum.

## Dívidas técnicas

- `npm audit` (dev): as mesmas 5 vulnerabilidades altas da Fase 1, na cadeia `eslint-config-next` → `fast-glob` → `micromatch`/`braces`; produção: 0.
- Testes de banco locais rodam em Postgres 16 com camada de compatibilidade; o CI usa Postgres 17 do Supabase — o job `banco` ainda não foi executado no GitHub (nenhum PR aberto).
- Política de retenção de evidências e procedimento de backup/restore: Fase 9.

## Ambiente de desenvolvimento observado

- Node 22.22; Postgres 16 local em 127.0.0.1:54322 (`npm run db:local:start`); daemon Docker indisponível.
- `npx supabase gen types --db-url` funciona sem Docker.

## Próximo passo recomendado

Aguardar autorização explícita para iniciar a **Fase 3 — Autenticação e usuários**.
