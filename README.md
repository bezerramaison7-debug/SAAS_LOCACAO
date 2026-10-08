# SAAS_LOCACAO — Rastreabilidade de Locações

MicroSaaS web, multiempresa, para rastrear equipamentos locados **depois** do pedido de compra feito no Sectra: recebimento, vistoria fotográfica, localização, responsável, movimentações, ocorrências, devolução, encerramento de cobrança e relatório em PDF.

> **Estado:** Fase 3 (autenticação e usuários) concluída: login, logout, recuperação de senha, empresa ativa, permissões no servidor e administração de usuários. Módulos de negócio a partir da Fase 4 — veja [`docs/PROJECT_STATE.md`](docs/PROJECT_STATE.md).

## Requisitos

- Node.js 22 (`.nvmrc`) e npm
- Banco local: Supabase CLI + Docker **ou**, sem Docker, PostgreSQL 16+ instalado (scripts em `scripts/db/`)

## Primeiros passos

```bash
npm ci
cp .env.example .env.local   # preencha os valores (ver tabela abaixo)
npm run dev                  # http://localhost:3000
```

### Variáveis de ambiente

| Variável                               | Visibilidade | Obrigatória | Uso                                                 |
| -------------------------------------- | ------------ | ----------- | --------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`                  | pública      | sim         | URL da aplicação (links de e-mail, QR Code)         |
| `NEXT_PUBLIC_SUPABASE_URL`             | pública      | sim         | URL do projeto Supabase                             |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | pública      | sim         | Chave publishable; acesso limitado por RLS          |
| `SUPABASE_SERVICE_ROLE_KEY`            | **secreta**  | sim         | Ignora RLS; usada só em `src/lib/supabase/admin.ts` |
| `REPORT_SIGNING_SECRET`                | **secreta**  | sim         | HMAC dos relatórios (mín. 32 caracteres)            |
| `SENTRY_DSN`                           | secreta      | não         | Monitoramento de erros                              |

Sem as variáveis públicas o **build** falha; sem qualquer obrigatória o **servidor** não atende requisições e registra quais faltam.

## Banco de dados local

Com Docker (fidelidade total):

```bash
npx supabase start          # API, Auth, Storage e Postgres em 127.0.0.1:54321/54322
npx supabase db reset       # migrations + seed de demonstração
```

Sem Docker — stack completa (Postgres + Auth + PostgREST + Mailpit, mesmas versões do CLI, D-36):

```bash
npm run stack:iniciar       # baixa os binários na 1ª vez, recria o banco e sobe tudo
# API 127.0.0.1:54321 · Postgres 54322 · e-mails capturados em http://127.0.0.1:54324
node scripts/stack/chaves.mjs   # chaves anon/service_role de DEMONSTRAÇÃO para o .env.local
npm run stack:parar
```

Sem Docker — só o banco (testes de integração/RLS):

```bash
npm run db:local:start      # Postgres em 127.0.0.1:54322 (postgres/postgres)
npm run db:local:reset      # recria: compatibilidade + migrations + seed
```

Depois de alterar migrations: `npm run db:types` (atualiza `src/types/database.ts`).

**Dados de demonstração** (somente DEV/CI): empresas `[DEMONSTRAÇÃO] Empresa A/B`; usuários `admin.a`, `compras.a`, `operacao.a`, `responsavel.a`, `financeiro.a`, `gestor.a`, `auditor.a`, `inativo.a`, `admin.b`, `operacao.b`, `sem.empresa` — `recuperacao.a`, `multi` (A e B) — todos `@demo.rastreio.test`, senha `Demo@123456`. O seed recusa rodar em banco marcado com `alter database postgres set app.ambiente = 'producao'` (faça isso em produção).

## Scripts

| Comando                                                  | O que faz                                                                            |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `npm run dev`                                            | Servidor de desenvolvimento (http://127.0.0.1:3100)                                  |
| `npm run build` / `npm start`                            | Build e execução de produção                                                         |
| `npm run format` / `format:check`                        | Prettier                                                                             |
| `npm run lint`                                           | ESLint (zero avisos)                                                                 |
| `npm run typecheck`                                      | Gera tipos de rotas e roda `tsc`                                                     |
| `npm test`                                               | Testes unitários (Vitest)                                                            |
| `npm run test:integration`                               | Integração com banco: paridade TS×SQL, integridade, triggers, auditoria, saldo, seed |
| `npm run test:rls`                                       | RLS: isolamento entre empresas, perfis, anônimo, inativo, storage                    |
| `npm run e2e`                                            | Playwright contra o build de produção (requer Supabase/stack e `npm run build`)      |
| `npm run db:local:start` / `db:local:reset` / `db:types` | Banco local sem Docker / recriar / gerar tipos                                       |
| `npm run check:bundle-secrets`                           | Garante que nenhum segredo foi parar no bundle do navegador                          |
| `npm run validate`                                       | Formatação + lint + tipos + unit + build + varredura de segredos                     |

`E2E_FULL=1 npm run e2e` inclui Firefox e WebKit (suíte pré-implantação).

## Estrutura

```
src/app            rotas (App Router); (app)/ = telas autenticadas
src/components     ui/ (design system), forms/, tables/, layout/, domain/
src/features       módulos de domínio (a partir da Fase 4)
src/lib            env, supabase, observability, security, format, validation
src/proxy.ts       request id, CSP com nonce, renovação de sessão
supabase/          config.toml, migrations/, seed.sql, tests/bootstrap-local.sql
tests/             e2e/ (Playwright), rls/, integration/, support/
docs/              contrato técnico e estado do projeto
```

## Documentação

| Documento                                          | Conteúdo                                                             |
| -------------------------------------------------- | -------------------------------------------------------------------- |
| [`docs/PROJECT_STATE.md`](docs/PROJECT_STATE.md)   | Estado atual e próximo passo                                         |
| [`docs/business-rules.md`](docs/business-rules.md) | Regras de negócio, máquinas de estado, cálculos, critérios de aceite |
| [`docs/architecture.md`](docs/architecture.md)     | Arquitetura, versões, modelo de dados, segurança, CI                 |
| [`docs/permissions.md`](docs/permissions.md)       | Matriz de permissões                                                 |
| [`docs/decisions.md`](docs/decisions.md)           | Decisões arquiteturais                                               |
| [`docs/backlog.md`](docs/backlog.md)               | Fases, backlog e riscos                                              |

## Deploy

Instruções completas de implantação (Vercel + Supabase, ambientes DEV/HOMOLOGAÇÃO/PRODUÇÃO separados) serão documentadas até a Fase 9. Princípios já definidos em `docs/architecture.md §10–13`.
