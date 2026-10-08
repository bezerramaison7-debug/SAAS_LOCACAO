# Estado atual do projeto

## Fase atual

**Fase 5 — Recebimento e evidências: CONCLUÍDA, aguardando autorização para a Fase 6 (Movimentações e ocorrências).**

## Última tarefa concluída

Gate da Fase 5 atingido: a Operação faz um recebimento completo no celular (375 px), com bem individual avariado e lote, fotos pela câmera, checklist de entrada da versão vigente, local e responsável, revisão e confirmação transacional; as evidências são privadas (URL assinada de 5 min só para quem lê a entidade; anônimo 401, outra empresa 404). Também verificado em 768 e 1280 px.

## Funcionalidades concluídas

**Fases 1–4:** fundação, banco multiempresa com RLS, autenticação real, usuários, cadastros, locações em etapas com Sectra manual, lista e detalhe.

**Fase 5:**

- Recebimento em 6 telas (D-50): criação para locação ATIVA; itens e identificação (série/placa/patrimônio conforme a categoria, condição); fotos com `capture`; checklist de entrada (versão vigente congelada, respostas validadas por tipo, fotos por pergunta); local, responsável e data do fato (fuso da empresa); revisão com pendências do banco.
- Confirmação transacional (`rpc_confirmar_recebimento`): bens DISPONIVEL no local/responsável, lote por item, vistorias vinculadas e concluídas, `inicio_efetivo` da locação, ocorrência AVARIA para avariado, auditoria.
- Excesso (RN-25, D-48): aguarda autorização de Compras com justificativa; autorização confirma e abre DIVERGENCIA_QUANTIDADE; reabrir para corrigir.
- Descarte de rascunho (autor/ADMIN) e cancelamento de confirmado (ADMIN, sem eventos posteriores — F5.6).
- Evidências (D-49): `POST /api/files` e `GET /api/files/{id}`; substituição e remoção lógica com motivo; galeria com miniaturas.
- `/bens` (bens e lotes, filtros por código/série/local), detalhe de bem e lote (vistorias, fotos, recebimento), `/vistorias` e detalhe somente leitura.
- F4.8: contrato e documentos anexados à locação (aba Documentos).
- Ação primária "Registrar recebimento" na locação ativa.
- Storage API oficial na stack local sem Docker (D-51).
- Migration 013 `20261008123000_recebimento_vistoria_evidencias`.

## Funcionalidades parciais

- Movimentações, ocorrências (tratamento), devoluções, cobranças, relatórios e painel ainda exibem "disponível a partir da Fase N" (D-28).
- F5.7 (geolocalização opcional nas fotos, P1): a API já aceita latitude/longitude, mas a interface não as coleta.
- F4.7 (aditivo de itens, P1) continua pendente (D-46).

## Próximas tarefas

Fase 6 — transferência de local/responsável com aceite, linha do tempo, tratamento de ocorrências, troca, manutenção, extravio e QR Code.

## Bugs conhecidos

Nenhum.

## Decisões tomadas

D-01 a D-53 em `docs/decisions.md`. Novas: D-47 (vistoria sobre a linha do recebimento), D-48 (excesso), D-49 (evidências), D-50 (fluxo em 6 telas), D-51 (Storage local), D-52 (CSP e https), D-53 (pré-condições de E2E).

## Migrations aplicadas

`20261008120000` … `20261008120900` (Fase 2), `20261008121000` (Fase 3), `20261008122000` (Fase 4), `20261008123000_recebimento_vistoria_evidencias` (Fase 5).

## Variáveis/configurações necessárias

Sem variáveis novas. Homologação/produção: buckets privados criados pela migration 010; `NEXT_PUBLIC_SUPABASE_URL` em https (D-52).

## Arquivos importantes

- `src/lib/evidencias/*`, `src/app/api/files/**`, `src/features/evidencias/**`.
- `src/features/recebimentos/**`, `src/app/(app)/recebimentos/**`.
- `src/features/bens/**`, `src/app/(app)/bens/**`, `src/app/(app)/vistorias/**`.
- `supabase/migrations/20261008123000_recebimento_vistoria_evidencias.sql`.
- `scripts/stack/storage.sh`, `supabase/tests/bootstrap-storage-shim.sql`.
- `tests/integration/recebimentos.test.ts`, `tests/e2e/recebimentos.spec.ts`, `tests/e2e/support/dados.ts`.

## Testes atualmente passando

- Unit: 246 (28 arquivos).
- Integração: 114 (7 arquivos).
- RLS: 235 (4 arquivos).
- E2E (Chromium 375/768/1280, Auth e Storage reais): 264 passando, 11 pulados por aplicabilidade.

## Testes atualmente falhando

Nenhum.

## Dívidas técnicas

- `npm audit` (dev): as mesmas vulnerabilidades da cadeia `eslint-config-next`; produção: 0.
- CI (`supabase start`) ainda não executado no GitHub (nenhum PR aberto).
- Páginas sem permissão retornam HTTP 200 com conteúdo de 404 (D-37).
- Imagens não são decodificadas no servidor (só _magic bytes_); PDF ativo detectado por varredura simples; sem job de limpeza de órfãos (D-49).
- Abas do detalhe da locação limitadas a 200 linhas.

## Ambiente de desenvolvimento observado

- Sem daemon Docker; Docker Hub acessível com limite de pulls anônimos (100/h por IP compartilhado — o extrator espera em 429); ECR Public bloqueado pelo proxy para blobs; GitHub bloqueado.
- Stack local: `npm run stack:iniciar` (Postgres 54322, API 54321 com Auth/REST/Storage, Mailpit 54324).

## Próximo passo recomendado

Aguardar autorização explícita para iniciar a **Fase 6 — Movimentações e ocorrências**.
