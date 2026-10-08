# Estado atual do projeto

## Fase atual
**Fase 0 — Descoberta e contrato técnico: CONCLUÍDA, aguardando autorização para a Fase 1.**

## Última tarefa concluída
Criação dos documentos de contrato técnico: `business-rules.md`, `architecture.md`, `permissions.md`, `decisions.md`, `backlog.md` e este arquivo.

## Funcionalidades concluídas
Nenhuma funcionalidade de produto (por definição da Fase 0 nada foi programado).

## Funcionalidades parciais
Nenhuma.

## Próximas tarefas
1. Responsável pelo produto revisar suposições S-01…S-10 (`business-rules.md §11`) e decisões em status **Proposta** (D-12, D-13, D-15, D-21).
2. Fornecer, se possível, exemplos anonimizados: pedido Sectra, relatório fotográfico atual, comprovante de retirada, categorias e checklist usados.
3. Após autorização: Fase 1 (fundação) — backlog E0 em `backlog.md`.

## Bugs conhecidos
Nenhum.

## Decisões tomadas
D-01 a D-23 em `docs/decisions.md` (D-12, D-13, D-15, D-21 aguardam validação).

## Migrations aplicadas
Nenhuma.

## Variáveis/configurações necessárias
Definidas em `architecture.md §10` (`.env.example` será criado na Fase 1).

## Arquivos importantes
- `docs/business-rules.md` — regras RN-xx, máquinas de estado, cálculos, KPIs, critérios de aceite CA-xx, suposições.
- `docs/architecture.md` — stack, estrutura, modelo de dados/diagrama, camadas de segurança, storage, auditoria, PDF, CI.
- `docs/permissions.md` — matriz papel × permissão, matriz por tabela, storage, casos de teste RLS.
- `docs/decisions.md` — ADRs.
- `docs/backlog.md` — fases, backlog priorizado, riscos.

## Testes atualmente passando
Nenhum teste existe ainda.

## Testes atualmente falhando
Nenhum.

## Dívidas técnicas
Nenhuma.

## Ambiente de desenvolvimento observado
- Node 22.22, npm e pnpm disponíveis; registro npm acessível (Next.js 16.4.0 é a última estável no registro).
- Postgres 16 instalado; **daemon Docker indisponível** → Supabase CLI local não sobe neste container (ver D-19).

## Próximo passo recomendado
Aguardar autorização explícita para iniciar a **Fase 1 — Fundação**.
