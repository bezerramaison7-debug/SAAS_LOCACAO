# Estado atual do projeto

## Fase atual

**Fase 7 — Devolução e financeiro: CONCLUÍDA, aguardando autorização para a Fase 8 (Dashboard e relatórios).**

## Última tarefa concluída

Gate da Fase 7 atingido: encerramentos operacional e financeiro independentes. Provado por integração (CA-50..55: saldo só muda na retirada, retirada nunca encerra cobrança, saldo zerado → encerramento pendente, nenhum encerramento altera o outro, nas duas ordens) e por E2E em 375/768/1280 px (devolução parcial de lote e de bem individual com vistoria de saída e comprovante; financeiro encerra com data enquanto a operação segue em devolução; depois a operação encerra sem tocar no financeiro).

## Funcionalidades concluídas

**Fases 1–4:** fundação, banco multiempresa com RLS, autenticação real, usuários, cadastros, locações em etapas com Sectra manual, lista e detalhe.

**Fase 7:**

- Devolução em etapas (D-62..D-66): solicitação a partir da locação (bens e quantidades de lote, com reserva), agendamento/reagendamento, vistoria de saída por item, retirada (parcial, condição, quem recebeu pelo fornecedor, retirada imediata), comprovante, conferência, cancelamento com motivo, ciência financeira.
- Desmobilização automática quando as devoluções cobrem todo o saldo, revertida se a devolução for cancelada (D-64); desmobilização manual.
- Encerramento operacional e financeiro independentes, com pendências explicadas no painel da locação (D-67).
- Cobranças: registrar, conferir, divergir, resolver, documento anexo; pendências do financeiro (encerramentos e ciências) em `/cobrancas` (D-69).
- Estimativa do período com o aviso de RN-72 (D-68).
- Linha do tempo com solicitação e retirada da devolução.
- Correção: envio de arquivo só após a hidratação (causa da falha intermitente da Fase 6 — D-70).
- Migration 015 `20261008125000_devolucoes_cobrancas`.

**Fase 6:**

- Movimentação de bem e lote (total ou parcial com divisão), com ou sem aceite; aceite/recusa pelo destinatário, aceite administrativo, cancelamento; data do fato em ordem cronológica; correção como novo evento (D-54..D-56).
- "Aguardando o seu aceite" em `/movimentacoes`; "Só meus itens" em `/bens`.
- Ficha do bem/lote com alertas (transferência pendente, ocorrências abertas/vencidas, vistoria em andamento), ações possíveis no estado atual e linha do tempo imutável.
- Ocorrências: registrar, tratar (responsável/prazo), resolver, reabrir, cancelar, vencidas; manutenção e extravio com efeito no estado e reversão (D-57).
- Troca pelo fornecedor: novo bem + vistoria de entrada; antigo SUBSTITUIDO (D-59).
- Vistoria periódica com checklist vigente, fotos por pergunta e conclusão imutável (D-60).
- QR Code na ficha, `/q/{id}` e etiqueta imprimível (D-58).
- Migration 014 `20261008124000_movimentacoes_ocorrencias`.

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

- Relatórios e painel ainda exibem "disponível a partir da Fase N" (D-28).
- Vistoria periódica é iniciada manualmente; agendamento/lembrete de periodicidade não foi implementado (F6.8, P2).
- F5.7 (geolocalização opcional nas fotos, P1): a API já aceita latitude/longitude, mas a interface não as coleta.
- F4.7 (aditivo de itens, P1) continua pendente (D-46).

## Próximas tarefas

Fase 8 — painel com indicadores clicáveis, alertas e relatórios assíncronos em PDF com fotos e hash.

## Bugs conhecidos

Nenhum.

## Decisões tomadas

D-01 a D-70 em `docs/decisions.md`. Novas na Fase 7: D-62 (devolução só por funções), D-63 (vistoria de saída), D-64 (desmobilização automática), D-65 (retirada parcial), D-66 (comprovante), D-67 (encerramentos), D-68 (estimativa), D-69 (cobranças), D-70 (envio após hidratação).

## Migrations aplicadas

`20261008120000` … `20261008120900` (Fase 2), `20261008121000` (Fase 3), `20261008122000` (Fase 4), `20261008123000_recebimento_vistoria_evidencias` (Fase 5), `20261008124000_movimentacoes_ocorrencias` (Fase 6), `20261008125000_devolucoes_cobrancas` (Fase 7).

## Variáveis/configurações necessárias

Sem variáveis novas (o QR usa `NEXT_PUBLIC_APP_URL`). Homologação/produção: buckets privados criados pela migration 010; `NEXT_PUBLIC_SUPABASE_URL` em https (D-52).

## Arquivos importantes

- `src/features/{devolucoes,cobrancas,encerramentos}/**`, `src/app/(app)/{devolucoes,cobrancas}/**`.
- `supabase/migrations/20261008125000_devolucoes_cobrancas.sql`, `tests/integration/devolucoes.test.ts`, `tests/e2e/devolucoes.spec.ts`.
- `src/features/movimentacoes/**`, `src/features/ocorrencias/**`, `src/features/bens/{ficha,linha-do-tempo,form-troca,actions}.tsx?`, `src/lib/qr/qr.ts`.
- `src/app/(app)/{movimentacoes,ocorrencias,q}/**`, `src/app/etiquetas/**`, `src/app/(app)/bens/[id]/troca`.
- `supabase/migrations/20261008124000_movimentacoes_ocorrencias.sql`, `tests/integration/movimentacoes.test.ts`, `tests/e2e/movimentacoes.spec.ts`.
- `src/lib/evidencias/*`, `src/app/api/files/**`, `src/features/evidencias/**`.
- `src/features/recebimentos/**`, `src/app/(app)/recebimentos/**`.
- `src/features/bens/**`, `src/app/(app)/bens/**`, `src/app/(app)/vistorias/**`.
- `supabase/migrations/20261008123000_recebimento_vistoria_evidencias.sql`.
- `scripts/stack/storage.sh`, `supabase/tests/bootstrap-storage-shim.sql`.
- `tests/integration/recebimentos.test.ts`, `tests/e2e/recebimentos.spec.ts`, `tests/e2e/support/dados.ts`.

## Testes atualmente passando

- Unit: 262 (32 arquivos).
- Integração: 144 (9 arquivos).
- RLS: 235 (4 arquivos).
- E2E (Chromium 375/768/1280, Auth e Storage reais): 294 passando, 11 pulados por aplicabilidade.

## Testes atualmente falhando

Nenhum. A falha intermitente da Fase 6 (envio de contrato) teve a causa encontrada e corrigida (D-70).

## Dívidas técnicas

- `npm audit` (dev): as mesmas vulnerabilidades da cadeia `eslint-config-next`; produção: 0.
- CI (`supabase start`) ainda não executado no GitHub (nenhum PR aberto).
- Páginas sem permissão retornam HTTP 200 com conteúdo de 404 (D-37).
- Imagens não são decodificadas no servidor (só _magic bytes_); PDF ativo detectado por varredura simples; sem job de limpeza de órfãos (D-49).
- Abas do detalhe da locação limitadas a 200 linhas.
- `/vistorias` e `/movimentacoes` sem busca por bem/lote (filtro só por situação).
- Retirada confirmada não pode ser desfeita pela interface (o banco já prevê ENCERRAMENTO_PENDENTE → EM_COBRANCA para um cancelamento administrativo futuro).
- Filtros "sem comprovante"/"sem documento" consideram até 1000 registros por consulta.

## Ambiente de desenvolvimento observado

- Sem daemon Docker; Docker Hub acessível com limite de pulls anônimos (100/h por IP compartilhado — o extrator espera em 429); ECR Public bloqueado pelo proxy para blobs; GitHub bloqueado.
- Stack local: `npm run stack:iniciar` (Postgres 54322, API 54321 com Auth/REST/Storage, Mailpit 54324).

## Próximo passo recomendado

Aguardar autorização explícita para iniciar a **Fase 8 — Dashboard e relatórios**.
