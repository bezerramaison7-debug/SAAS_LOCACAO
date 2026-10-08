# Estado atual do projeto

## Fase atual

**Fase 1 — Fundação: CONCLUÍDA, aguardando autorização para a Fase 2 (Banco e segurança).**

## Última tarefa concluída

Fundação do projeto: Next.js 16.4 + TypeScript strict, lint, Prettier, Vitest, Playwright, Tailwind 4, design system com tema claro/escuro, layout responsivo, clientes Supabase, validação de ambiente, proxy com CSP/request id, observabilidade básica e CI.

## Funcionalidades concluídas

- Configuração do projeto e scripts de validação (`npm run validate`).
- Design system: tokens (contraste AA testado nos dois temas), Button, Input/Textarea/Select/Label, FormField acessível, Badge, Alert, Skeleton, EmptyState, ConfirmDialog, PageHeader, DataTable responsiva (tabela ↔ cartões), Pagination server-side (25/50/100, filtros na URL).
- App shell: sidebar recolhível persistida (desktop ≥1024px), navegação inferior + menu "Mais" (celular/tablet), seletor de tema (claro/escuro/sistema, sem flash), link "pular para o conteúdo", páginas 404/erro/carregando.
- Clientes Supabase: servidor (JWT do usuário + `x-request-id`), admin (service role, `server-only`), renovação de sessão no proxy. Cookies HttpOnly.
- Validação de ambiente: build (públicas) e inicialização (todas).
- Segurança HTTP: CSP com nonce por requisição, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP, HSTS (produção), sem `x-powered-by`.
- Observabilidade: logger JSON com redaction, `medir()`, request id validado, `/api/health`.
- Formatação pt-BR: datas no fuso da empresa (`dd/MM/yyyy HH:mm`), conversão datetime-local↔UTC, moeda e quantidades sem float, atraso de lançamento (RN-103).
- Schemas Zod comuns: uuid, paginação, dinheiro, quantidade, data do evento (não futura), justificativa.
- CI (GitHub Actions): `npm ci`, audit de produção, format, lint, typecheck, unit, build, varredura de segredos, E2E smoke.

## Funcionalidades parciais

- Rotas dos módulos existem apenas com o estado explícito "disponível a partir da Fase N" (D-28). Nenhum módulo de negócio implementado.
- Shell sem autenticação (permitido na Fase 1; verificação entra na Fase 3).
- `/api/health` ainda não verifica o banco (Fase 2).

## Próximas tarefas

Fase 2 — migrations, constraints, índices, triggers, RLS, funções de segurança, storage privado, seed, testes de isolamento A×B (backlog E1).

## Bugs conhecidos

Nenhum.

## Decisões tomadas

D-01 a D-29 em `docs/decisions.md` (todas aceitas). Novas nesta fase: D-24 (Cache Components off), D-25 (cookies HttpOnly, sem cliente no navegador), D-26 (validação de ambiente), D-27 (matriz de navegadores E2E), D-28 (módulos em construção explícitos), D-29 (fonte do sistema).

## Migrations aplicadas

Nenhuma.

## Variáveis/configurações necessárias

Ver `.env.example` e tabela no README. Para desenvolvimento/testes locais, `.env.local` com valores fictícios.

## Arquivos importantes

- `src/proxy.ts` — request id, CSP, sessão.
- `src/instrumentation.ts`, `src/lib/env/*` — validação de ambiente.
- `src/lib/supabase/{server,admin,proxy,cookies}.ts` — clientes Supabase.
- `src/styles/globals.css` — tokens de tema.
- `src/components/ui/*`, `src/components/layout/*`, `src/components/tables/*`, `src/components/forms/*`.
- `src/lib/format/*`, `src/lib/validation/comum.ts`, `src/lib/observability/*`, `src/lib/security/csp.ts`.
- `vitest.config.mts`, `playwright.config.ts`, `.github/workflows/ci.yml`, `scripts/check-bundle-secrets.mjs`.

## Testes atualmente passando

- Unit (Vitest): 89 testes / 9 arquivos.
- E2E (Playwright, Chromium 375/768/1280): 46 passando, 5 pulados por aplicabilidade de viewport.

## Testes atualmente falhando

Nenhum.

## Dívidas técnicas

- `npm audit` acusa 5 vulnerabilidades altas apenas em dependências de desenvolvimento (cadeia `eslint-config-next` → `fast-glob` → `micromatch`); produção: 0. Acompanhar atualização do `eslint-config-next`.
- Servidor sem variáveis obrigatórias responde 500 em vez de encerrar o processo (comportamento do hook de instrumentação do Next).

## Ambiente de desenvolvimento observado

- Node 22.22; Postgres 16 instalado; **daemon Docker indisponível** → Supabase CLI local não sobe neste container (D-19: Postgres local + bootstrap na Fase 2).
- Chromium do Playwright pré-instalado em `/opt/pw-browsers` (versão diferente da do @playwright/test; config usa `executablePath` fora do CI).

## Próximo passo recomendado

Aguardar autorização explícita para iniciar a **Fase 2 — Banco e segurança**.
