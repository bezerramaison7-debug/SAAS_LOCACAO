# SAAS_LOCACAO — Rastreabilidade de Locações

MicroSaaS web, multiempresa, para rastrear equipamentos locados **depois** do pedido de compra feito no Sectra: recebimento, vistoria fotográfica, localização, responsável, movimentações, ocorrências, devolução, encerramento de cobrança e relatório em PDF.

> **Estado:** Fase 0 (contrato técnico) concluída. Nenhum código de aplicação ainda. Veja `docs/PROJECT_STATE.md`.

## Documentação
| Documento | Conteúdo |
|-----------|----------|
| [`docs/PROJECT_STATE.md`](docs/PROJECT_STATE.md) | Estado atual e próximo passo |
| [`docs/business-rules.md`](docs/business-rules.md) | Regras de negócio, máquinas de estado, cálculos, critérios de aceite |
| [`docs/architecture.md`](docs/architecture.md) | Arquitetura, modelo de dados, segurança, CI |
| [`docs/permissions.md`](docs/permissions.md) | Matriz de permissões |
| [`docs/decisions.md`](docs/decisions.md) | Decisões arquiteturais |
| [`docs/backlog.md`](docs/backlog.md) | Fases, backlog e riscos |

## Stack prevista
Next.js 16 (App Router) · TypeScript strict · Tailwind CSS · Supabase (Postgres, Auth, Storage) · Zod · Vitest · Playwright.

Instruções de instalação, execução e deploy serão adicionadas a partir da Fase 1.
