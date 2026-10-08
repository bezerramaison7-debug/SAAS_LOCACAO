# SAAS_LOCACAO — Rastreabilidade de Locações

MicroSaaS web, multiempresa, para rastrear equipamentos locados **depois** do pedido de compra feito no Sectra: recebimento, vistoria fotográfica, localização, responsável, movimentações, ocorrências, devolução, encerramento de cobrança e relatório em PDF.

> **Estado:** Fase 1 (fundação) concluída. Ainda não há banco, autenticação nem módulos de negócio — veja [`docs/PROJECT_STATE.md`](docs/PROJECT_STATE.md).

## Requisitos

- Node.js 22 (`.nvmrc`) e npm
- Supabase CLI + Docker (a partir da Fase 2, para banco local)

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

## Scripts

| Comando                           | O que faz                                                          |
| --------------------------------- | ------------------------------------------------------------------ |
| `npm run dev`                     | Servidor de desenvolvimento                                        |
| `npm run build` / `npm start`     | Build e execução de produção                                       |
| `npm run format` / `format:check` | Prettier                                                           |
| `npm run lint`                    | ESLint (zero avisos)                                               |
| `npm run typecheck`               | Gera tipos de rotas e roda `tsc`                                   |
| `npm test`                        | Testes unitários (Vitest)                                          |
| `npm run test:integration`        | Integração com banco (a partir da Fase 2)                          |
| `npm run test:rls`                | Testes de RLS (a partir da Fase 2)                                 |
| `npm run e2e`                     | Playwright contra o build de produção (rode `npm run build` antes) |
| `npm run check:bundle-secrets`    | Garante que nenhum segredo foi parar no bundle do navegador        |
| `npm run validate`                | Formatação + lint + tipos + unit + build + varredura de segredos   |

`E2E_FULL=1 npm run e2e` inclui Firefox e WebKit (suíte pré-implantação).

## Estrutura

```
src/app            rotas (App Router); (app)/ = telas autenticadas
src/components     ui/ (design system), forms/, tables/, layout/, domain/
src/features       módulos de domínio (a partir da Fase 4)
src/lib            env, supabase, observability, security, format, validation
src/proxy.ts       request id, CSP com nonce, renovação de sessão
tests/e2e          Playwright
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
