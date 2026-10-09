# Testes — cobertura e matriz

> Fase 9 — F9.1/F9.2. Como rodar: `README.md` → Scripts.

## 1. Camadas

| Camada     | Comando                    | O que prova                                                                                              |
| ---------- | -------------------------- | -------------------------------------------------------------------------------------------------------- |
| Unit       | `npm test`                 | Máquinas de estado, saldo, permissões, Zod, datas/fuso, moeda, segurança (CSP, cookies), PDF/integridade |
| Integração | `npm run test:integration` | Cada `rpc_*` com Postgres real: paridade TS×SQL, triggers, auditoria, saldo, seed, relatórios            |
| RLS        | `npm run test:rls`         | Isolamento A×B, cada papel, anônimo, inativo, Storage, inventário de `security definer`                  |
| E2E        | `npm run e2e`              | Fluxos reais no build de produção com Auth, Storage e e-mail reais (stack local)                         |
| Backup     | `npm run backup:testar`    | Dump → restauração em banco novo → comparação → arquivos conferidos por SHA-256 (`docs/backup.md`)       |

## 2. Matriz de navegadores e telas

| Execução                                 | Navegadores               | Telas                                          |
| ---------------------------------------- | ------------------------- | ---------------------------------------------- |
| PR e `main` (`npm run e2e`)              | Chromium                  | celular 375 px, tablet 768 px, desktop 1280 px |
| Diária 05:17 UTC e manual (`E2E_FULL=1`) | Chromium, Firefox, WebKit | as mesmas três (Firefox sem `isMobile`)        |

Projetos Playwright: `<navegador>-<tela>` (ex.: `webkit-celular`). Testes que dependem de teclado físico pulam no celular; testes de servidor (worker, formulário com limite de taxa) rodam uma vez, no desktop.

## 3. Os 16 cenários obrigatórios

| #   | Cenário                       | Onde                                                                                                                                      |
| --- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Login                         | `autenticacao.spec.ts` — "login válido…", senha incorreta, campos inválidos, retorno ao destino; `teclado.spec.ts` — login só com teclado |
| 2   | Logout                        | `autenticacao.spec.ts` — "logout encerra a sessão e protege as rotas novamente"                                                           |
| 3   | Criar locação                 | `locacoes.spec.ts` — "GATE: cadastra fornecedor, cria e ativa locação completa…"                                                          |
| 4   | Vincular Sectra               | idem (número do documento Sectra, pendência "Vincule o pedido do Sectra")                                                                 |
| 5   | Item individual               | idem (estação total, quantidade inteira obrigatória)                                                                                      |
| 6   | Item em lote                  | idem (andaime, 10,5 peças)                                                                                                                |
| 7   | Receber equipamento           | `recebimentos.spec.ts` — "recebe bem individual avariado e lote, com fotos e checklist, e confirma"; excesso autorizado por Compras       |
| 8   | Adicionar evidência           | `recebimentos.spec.ts` (fotos, contrato PDF, API de arquivos recusando origem externa/outra empresa/conteúdo falso); `relatorios.spec.ts` |
| 9   | Transferir equipamento        | `movimentacoes.spec.ts` — sem aceite, parcial de lote, com aceite/recusa; `teclado.spec.ts` — movimentação só com teclado                 |
| 10  | Registrar ocorrência          | `movimentacoes.spec.ts` — manutenção/extravio/resolução; `teclado.spec.ts` — ocorrência e cancelamento pelo diálogo                       |
| 11  | Devolver parte de lote        | `devolucoes.spec.ts` — "devolução parcial de lote e de bem individual…"                                                                   |
| 12  | Devolver bem individual       | idem                                                                                                                                      |
| 13  | Encerramento financeiro       | `devolucoes.spec.ts` — "encerramentos operacional e financeiro são independentes (cenário 13)"                                            |
| 14  | Gerar relatório               | `relatorios.spec.ts` — gate com fotos, hashes e download assinado; período pelo formulário; worker só com segredo                         |
| 15  | Restrição por perfil          | `perfis.spec.ts` (7 papéis), `cadastros.spec.ts`, `locacoes.spec.ts`, `recebimentos.spec.ts`, `usuarios-admin.spec.ts`                    |
| 16  | Acesso cruzado entre empresas | `isolamento.spec.ts`; outra empresa recebe 404 em `locacoes.spec.ts`, `recebimentos.spec.ts`, `relatorios.spec.ts`; RLS em `tests/rls/`   |

## 4. Complementares

| Tema                 | Onde                                                                                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acessibilidade (axe) | `acessibilidade.spec.ts` — 38 telas autenticadas em tema claro e escuro, WCAG 2.2 A/AA, zero violações sérias/críticas; telas públicas em `autenticacao.spec.ts` |
| Teclado              | `teclado.spec.ts` (foco visível exigido em cada parada), `acessibilidade.spec.ts` (pular para o conteúdo, menu só com Tab/Enter)                                 |
| Layout responsivo    | `layout.spec.ts` e verificação de largura excedente nas specs de fluxo                                                                                           |
| Painel (CA-72)       | `painel.spec.ts` — cada indicador = total da lista filtrada, por papel                                                                                           |
| Cabeçalhos/CSP       | `smoke.spec.ts`, `src/lib/security/*.test.ts`                                                                                                                    |
| Segredos no bundle   | `npm run check:bundle-secrets`                                                                                                                                   |
