# Estado atual do projeto

## Fase atual

**Fase 4 — Cadastros e locações: CONCLUÍDA, aguardando autorização para a Fase 5 (Recebimento, bens/lotes, vistoria e evidências).**

## Última tarefa concluída

Gate da Fase 4 atingido: Compras cadastra fornecedor, cria a locação em etapas (identificação → referências Sectra → itens individual e lote → vigência → revisão), ativa com persistência real e a encontra na lista pelo número do pedido (E2E em 375/768/1280 px).

## Funcionalidades concluídas

**Fases 1–3:** fundação, banco multiempresa com RLS, autenticação real, contexto de empresa, autorização no servidor, administração de usuários.

**Fase 4:**

- `/cadastros`: fornecedores, locais, centros de custo, categorias (modo individual/lote fixo na criação; identificação individual só para INDIVIDUAL), checklists versionados (rascunho → perguntas → publicar → nova versão). Busca, situação e paginação 25/50/100 na URL; inativação sem exclusão.
- `/locacoes`: busca server-side (`buscar_locacoes`) por código, pedido Sectra, fornecedor, bem ou lote; filtros de situação, fornecedor, centro de custo, local, período e término (7/15/30 dias) na URL.
- `/locacoes/nova` e `/locacoes/[id]/editar?etapa=…`: rascunho no servidor; referências Sectra manuais (D-41); itens com valores em pt-BR e transporte decimal exato (D-43); vigência; revisão com pendências do banco; ativação com confirmação.
- `/locacoes/[id]?aba=…`: resumo (saldos, documentos Sectra, vincular documento após ativação), itens com saldos, recebimentos, bens e lotes, movimentações, documentos, devoluções, cobranças, histórico — por permissão (D-45). Cancelamento com motivo.
- Migration 012 `20261008122000_locacoes_cadastros`.
- Menu "Cadastros" (`dados.ler_geral`).

## Funcionalidades parciais

- Recebimentos, bens, vistorias, movimentações, ocorrências, devoluções, cobranças, relatórios e painel ainda exibem "disponível a partir da Fase N" (D-28). As abas do detalhe já leem os dados reais dessas tabelas.
- F4.7 aditivo de itens e F4.8 anexo de contrato (P1) adiados (D-46).
- Storage API não está na stack local sem Docker (necessária na Fase 5).

## Próximas tarefas

Fase 5 — recebimento (rascunho, confirmação transacional, excesso com autorização), bens/lotes, vistoria de entrada com checklist vigente e evidências (upload privado). Incluir F4.8 (anexo de contrato) junto com o Storage e avaliar F4.7 (aditivo).

## Bugs conhecidos

Nenhum.

## Decisões tomadas

D-01 a D-46 em `docs/decisions.md`. Novas: D-41 (Sectra manual), D-42 (etapas com rascunho no servidor), D-43 (decimais), D-44 (busca SQL), D-45 (abas por URL/permissão), D-46 (aditivo/anexo adiados).

## Migrations aplicadas

`20261008120000` … `20261008120900` (Fase 2), `20261008121000_usuarios_autenticacao` (Fase 3), `20261008122000_locacoes_cadastros` (Fase 4).

## Variáveis/configurações necessárias

Sem novidades em relação à Fase 3 (`.env.local` com chaves de DEMONSTRAÇÃO, `NEXT_PUBLIC_APP_URL=http://127.0.0.1:3100`; produção com `app.ambiente = 'producao'`).

## Arquivos importantes

- `src/features/cadastros/**`, `src/features/locacoes/**`, `src/components/forms/acao-confirmada.tsx`.
- `src/app/(app)/cadastros/**`, `src/app/(app)/locacoes/**`.
- `src/lib/db/{busca,gerados}.ts`, `src/lib/format/{decimal-json,moeda}.ts`.
- `supabase/migrations/20261008122000_locacoes_cadastros.sql`.
- `tests/e2e/{cadastros,locacoes}.spec.ts`, `tests/integration/locacoes.test.ts`.

## Testes atualmente passando

- Unit: 227 (26 arquivos).
- Integração: 96 (6 arquivos).
- RLS: 235 (4 arquivos).
- E2E (Chromium 375/768/1280, Auth real): 248 passando, 9 pulados por aplicabilidade.

## Testes atualmente falhando

Nenhum.

## Dívidas técnicas

- `npm audit` (dev): as mesmas vulnerabilidades altas da cadeia `eslint-config-next`; produção: 0.
- O CI (`supabase start`) ainda não foi executado no GitHub (nenhum PR aberto).
- Páginas sem permissão retornam HTTP 200 com conteúdo de 404 por causa do streaming (D-37).
- Abas do detalhe limitam a 200 linhas por aba (sem paginação interna); suficiente para o MVP, revisar com volume real.

## Ambiente de desenvolvimento observado

- Sem daemon Docker; Docker Hub acessível; GitHub bloqueado pelo proxy.
- Stack local: `npm run stack:iniciar` (Postgres 54322, API 54321, Mailpit 54324).

## Próximo passo recomendado

Aguardar autorização explícita para iniciar a **Fase 5 — Recebimento, bens/lotes, vistoria e evidências**.
