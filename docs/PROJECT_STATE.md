# Estado atual do projeto

## Fase atual

**Fase 8 — Dashboard e relatórios: CONCLUÍDA, aguardando autorização para a Fase 9 (Qualidade e homologação).**

## Última tarefa concluída

Gate da Fase 8 atingido: o usuário gera o relatório completo da locação pela interface — com as fotos já registradas no sistema, baixadas do storage privado e normalizadas pelo servidor — sem manipular nenhum arquivo. Provado por E2E em 375/768/1280 px (pedido, acompanhamento até "Pronto", download por URL assinada, hash do arquivo conferido, PDF lido com todas as seções, foto desenhada e legenda) e por integração (CA-70: PDF renderizado e lido; fila, watchdog, permissões). CA-72: cada indicador do painel bate com o total da lista que abre, para ADMIN, FINANCEIRO e RESPONSAVEL_LOCAL.

## Funcionalidades concluídas

**Fases 1–4:** fundação, banco multiempresa com RLS, autenticação real, usuários, cadastros, locações em etapas com Sectra manual, lista e detalhe.

**Fase 8:**

- Painel (F8.1): 17 indicadores em grupos (operação, prazos, devoluções/evidências, financeiro), regra de cálculo visível em cada cartão, link para a lista filtrada com o mesmo total (D-71); alertas de términos em 7 dias e ocorrências vencidas (F8.6).
- Relatórios PDF (F8.2–F8.5): por locação, bem, local e período; pedido imediato, geração assíncrona com fila, watchdog e 3 tentativas; snapshot consistente; fotos normalizadas com legenda (evento, item, data, local, usuário); hash dos dados impresso, hash do arquivo e HMAC no banco; download por URL assinada (D-72..D-77).
- Atalhos "Gerar relatório PDF" na locação e na ficha do bem; `/relatorios` com formulário e histórico.
- Migration 016 `20261008126000_painel_relatorios`.

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

- Vistoria periódica é iniciada manualmente; agendamento/lembrete de periodicidade não foi implementado (F6.8, P2).
- F5.7 (geolocalização opcional nas fotos, P1): a API já aceita latitude/longitude, mas a interface não as coleta.
- F4.7 (aditivo de itens, P1) continua pendente (D-46).

## Próximas tarefas

Fase 9 — suíte completa em 3 navegadores, acessibilidade e teclado, revisão de segurança, backup/restore, guia de deploy e manual.

## Bugs conhecidos

Nenhum.

## Decisões tomadas

D-01 a D-78 em `docs/decisions.md`. Novas na Fase 8: D-71 (indicadores pela consulta da lista), D-72 (pedido com `after()` e worker), D-73 (snapshot só para o worker), D-74 (template PDF), D-75 (integridade), D-76 (fila), D-77 (tipos de relatório), D-78 (foto de teste).

## Migrations aplicadas

`20261008120000` … `20261008120900` (Fase 2), `20261008121000` (Fase 3), `20261008122000` (Fase 4), `20261008123000_recebimento_vistoria_evidencias` (Fase 5), `20261008124000_movimentacoes_ocorrencias` (Fase 6), `20261008125000_devolucoes_cobrancas` (Fase 7), `20261008126000_painel_relatorios` (Fase 8).

## Variáveis/configurações necessárias

Sem variáveis novas: o worker usa `REPORT_SIGNING_SECRET` (já obrigatória). Produção precisa de um agendador chamando `POST /api/reports/process` a cada minuto com `Authorization: Bearer <REPORT_SIGNING_SECRET>` (D-72). O QR usa `NEXT_PUBLIC_APP_URL`. Homologação/produção: buckets privados criados pela migration 010; `NEXT_PUBLIC_SUPABASE_URL` em https (D-52).

## Arquivos importantes

- `src/features/painel/**`, `src/features/relatorios/**`, `src/lib/relatorios/**`, `src/app/(app)/{dashboard,relatorios}/**`, `src/app/api/reports/**`.
- `supabase/migrations/20261008126000_painel_relatorios.sql`, `tests/integration/relatorios.test.ts`, `tests/e2e/{relatorios,painel}.spec.ts`.
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

- Unit: 270 (33 arquivos).
- Integração: 150 (10 arquivos).
- RLS: 235 (4 arquivos).
- E2E (Chromium 375/768/1280, Auth e Storage reais): 299 passando, 15 pulados por aplicabilidade.

## Testes atualmente falhando

Nenhum.

## Dívidas técnicas

- `npm audit` (dev): as mesmas vulnerabilidades da cadeia `eslint-config-next`; produção: 0.
- CI (`supabase start`) ainda não executado no GitHub (nenhum PR aberto).
- Páginas sem permissão retornam HTTP 200 com conteúdo de 404 (D-37).
- Imagens não são decodificadas no servidor (só _magic bytes_); PDF ativo detectado por varredura simples; sem job de limpeza de órfãos (D-49).
- Abas do detalhe da locação limitadas a 200 linhas.
- `/vistorias` e `/movimentacoes` sem busca por bem/lote (filtro só por situação).
- Retirada confirmada não pode ser desfeita pela interface (o banco já prevê ENCERRAMENTO_PENDENTE → EM_COBRANCA para um cancelamento administrativo futuro).
- Filtros "sem comprovante"/"sem documento" consideram até 1000 registros por consulta; soma do saldo de lotes do painel lê até 5000 lotes.
- Painel faz ~20 contagens por carregamento (D-71).
- PDF usa a fonte Helvetica embutida: caracteres fora do Latin-1/cp1252 saem como "?".
- Verificação pública do HMAC de um PDF (endpoint de conferência) ainda não existe; os hashes são exibidos na página do relatório.

## Ambiente de desenvolvimento observado

- Sem daemon Docker; Docker Hub acessível com limite de pulls anônimos (100/h por IP compartilhado — o extrator espera em 429); ECR Public bloqueado pelo proxy para blobs; GitHub bloqueado.
- Stack local: `npm run stack:iniciar` (Postgres 54322, API 54321 com Auth/REST/Storage, Mailpit 54324).

## Próximo passo recomendado

Aguardar autorização explícita para iniciar a **Fase 9 — Qualidade e homologação**.
