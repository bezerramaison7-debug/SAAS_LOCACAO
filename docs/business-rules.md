# Regras de negócio — MicroSaaS de Rastreabilidade de Locações

> Documento vivo. Fonte: especificação "Instruções para uma IA desenvolver o MicroSaaS Web de Locações" + prompt de papel.
> Decisões que preenchem lacunas da especificação estão marcadas com **[D-xx]** e detalhadas em `docs/decisions.md`.
> Suposições que precisam de validação do responsável pelo produto estão marcadas com **[S-xx]** (seção 11).

---

## 1. Compreensão do problema

A empresa contrata equipamentos locados (estações totais, computadores, andaimes, peças etc.). O **Sectra** continua sendo o sistema de requisição, solicitação e pedido de compra. O que falta hoje é a **rastreabilidade operacional depois do pedido**:

- o que foi contratado _versus_ o que chegou;
- em que condição chegou (checklist + fotos);
- onde cada bem/lote está e quem responde por ele;
- o que foi transferido, trocado, extraviado ou devolvido;
- quanto ainda está sob responsabilidade da empresa (saldo);
- se a devolução física realmente aconteceu (com comprovante);
- se a cobrança do fornecedor foi efetivamente encerrada.

O sistema é uma **camada de evidência e de estado operacional**: cada resposta precisa ser sustentada por eventos datados, com autor, e por documentos/fotos imutáveis. Ele **não** emite pedidos, não paga fornecedores e não fala com o Sectra por API.

### 1.1 Perguntas que o sistema precisa responder (rastreio → onde a resposta mora)

| #   | Pergunta                                   | Fonte da resposta                                                                           |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| 1   | Qual pedido do Sectra originou a locação?  | `referencias_externas` (sistema = SECTRA)                                                   |
| 2   | O que foi contratado?                      | `itens_locacao`                                                                             |
| 3   | O que foi efetivamente recebido?           | `recebimentos` CONFIRMADOS + `itens_recebimento`                                            |
| 4   | Onde cada bem/lote está?                   | `bens.local_atual_id` / `lotes.local_atual_id` (derivado da última movimentação confirmada) |
| 5   | Quem é o responsável atual?                | `bens.responsavel_atual_id` / `lotes.responsavel_atual_id`                                  |
| 6   | Em qual condição foi recebido?             | `itens_recebimento.condicao` + vistoria de ENTRADA                                          |
| 7   | Quais fotos comprovam?                     | `evidencias` vinculadas ao evento                                                           |
| 8   | Quais checklists foram preenchidos?        | `vistorias` + `respostas_vistoria` (versão do modelo congelada)                             |
| 9   | Quais documentos estão vinculados?         | `evidencias` tipo DOCUMENTO/CONTRATO/COMPROVANTE                                            |
| 10  | Quais itens foram movimentados?            | `movimentacoes`                                                                             |
| 11  | Quais foram transferidos?                  | `movimentacoes` CONFIRMADAS com troca de local/responsável                                  |
| 12  | Quais sofreram troca?                      | `ocorrencias` tipo TROCA + `bens.substitui_bem_id`                                          |
| 13  | Quais foram devolvidos?                    | `devolucoes` + `itens_devolucao` com retirada confirmada                                    |
| 14  | Qual saldo permanece sob responsabilidade? | visão `v_saldo_item_locacao` (seção 5)                                                      |
| 15  | A devolução física ocorreu?                | `devolucoes.status ∈ {RETIRADA_CONFIRMADA, CONFERIDA}` + comprovante                        |
| 16  | A cobrança foi encerrada?                  | `locacoes.status_financeiro = ENCERRADO` + data confirmada                                  |
| 17  | Quem executou cada operação?               | `*_por` nas tabelas de evento + `auditoria.ator_id`                                         |
| 18  | Quando ocorreu?                            | `data_evento` (fato) e `created_at` (registro) — separados                                  |
| 19  | Dados antes/depois?                        | `auditoria.dados_anteriores` / `dados_novos`                                                |

---

## 2. Glossário

| Termo                    | Significado                                                                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Empresa                  | Tenant. Todo dado operacional pertence a exatamente uma empresa.                                                                   |
| Locação                  | Contrato operacional com **um** fornecedor, com N itens contratados. Código `LOC-000123`.                                          |
| Referência externa       | Identificador manual de outro sistema (Sectra: pedido, requisição, solicitação, NF, contrato).                                     |
| Item de locação          | Linha contratada: categoria, descrição, quantidade, unidade, valor unitário, periodicidade, modo de controle.                      |
| Modo de controle         | `INDIVIDUAL` (cada unidade é um **bem**) ou `LOTE` (quantidade controlada como **lote**). Herdado da categoria; congelado no item. |
| Bem                      | Unidade física individual identificável (série, placa, identificação do fornecedor). Código `BEM-000045`.                          |
| Lote                     | Quantidade homogênea de um item, recebida num recebimento, num local e sob um responsável. Código `LOT-000012`.                    |
| Recebimento              | Evento de entrada física (parcial ou total). Rascunho até a confirmação. Código `REC-…`.                                           |
| Vistoria                 | Preenchimento de um checklist (versão específica) sobre um bem ou lote, ligado a um evento de origem.                              |
| Movimentação             | Mudança de local e/ou responsável de um bem/lote. Imutável depois de confirmada. Código `MOV-…`.                                   |
| Ocorrência               | Fato anômalo: avaria, defeito, extravio, troca, divergência. Código `OCR-…`.                                                       |
| Devolução                | Processo de retorno ao fornecedor, em etapas independentes. Código `DEV-…`.                                                        |
| Cobrança                 | Registro de um documento de cobrança do fornecedor (período, valor, documento) e de sua conferência. Código `COB-…`.               |
| Evidência                | Arquivo privado (foto/PDF) vinculado a uma entidade, com hash SHA-256.                                                             |
| Saldo                    | Quantidade ainda sob responsabilidade da empresa (seção 5).                                                                        |
| Encerramento operacional | Locação sem nenhum bem ativo nem saldo de lote. Evento de OPERAÇÃO.                                                                |
| Encerramento financeiro  | Confirmação, pelo FINANCEIRO, de que a cobrança terminou, com data. Evento independente.                                           |
| `data_evento`            | Quando o fato aconteceu no mundo físico (informado pelo usuário).                                                                  |
| `created_at`             | Quando o fato foi registrado no sistema (servidor, UTC).                                                                           |
| Lançamento com atraso    | Registro em que `created_at − data_evento` > limite configurado da empresa (padrão 24 h).                                          |

---

## 3. Regras de negócio (numeradas)

### 3.1 Multiempresa e identidade

- **RN-01** Todo registro operacional possui `empresa_id` direto. Relacionamentos entre registros só são válidos dentro da mesma empresa (garantido por FK composta `(empresa_id, id)`) **[D-05]**.
- **RN-02** A empresa de uma operação é derivada no servidor a partir do usuário autenticado e da sua associação ativa (`usuarios_empresa`). Nenhum `empresa_id` enviado pelo navegador é aceito como prova de autorização.
- **RN-03** Usuário com associação inativa não acessa nenhum dado da empresa correspondente.
- **RN-04** IDs são UUID; códigos legíveis (`LOC-000123`) são sequenciais **por empresa** e únicos `(empresa_id, codigo)` **[D-09]**.
- **RN-05** Locais e centros de custo têm código informado pelo usuário, único por empresa.

### 3.2 Locação

- **RN-10** Uma locação possui exatamente um fornecedor e um centro de custo, e pode ter vários itens.
- **RN-11** Cada item define `modo_controle` (herdado da categoria e congelado no item na criação).
- **RN-12** Locação é editável livremente apenas em `RASCUNHO`. Após `ATIVA`, alterações de cabeçalho exigem motivo e geram auditoria; itens contratados só podem ser **acrescidos** (aditivo) ou ter quantidade **aumentada** com motivo; nunca reduzidos abaixo do já recebido **[D-14]**.
- **RN-13** Para ativar (`RASCUNHO → ATIVA`) é obrigatório: fornecedor ativo, centro de custo ativo, ≥ 1 item com quantidade > 0, `inicio_previsto`, `termino_previsto ≥ inicio_previsto` e ≥ 1 referência SECTRA do tipo PEDIDO **[S-01]**.
- **RN-14** `ATIVA → CANCELADA` só é permitido se nenhum recebimento foi **confirmado** (rascunhos são cancelados junto).
- **RN-15** Integração com Sectra é **manual**: número, tipo, data do documento e anexo. `unique (empresa_id, sistema, tipo, numero)` impede o mesmo pedido em duas locações **[S-02]**.

### 3.3 Recebimento

- **RN-20** Recebimento só pode ser criado para locação `ATIVA`.
- **RN-21** Recebimento é `RASCUNHO` até a confirmação final; o rascunho é salvo no servidor a cada etapa. Nada de saldo, status de bem ou local muda antes da confirmação.
- **RN-22** A confirmação ocorre em **uma transação** (função PL/pgSQL): valida itens, quantidades, vistorias obrigatórias e fotos obrigatórias; cria/ativa bens e lotes; registra a movimentação inicial (local + responsável); grava auditoria.
- **RN-23** Item INDIVIDUAL: cada unidade recebida é um bem com código único; a categoria pode exigir número de série, placa ou identificação do fornecedor (`categorias_bem.exige_*`).
- **RN-24** Item LOTE: a quantidade recebida forma **um lote novo por (recebimento, item)** com local e responsável informados **[D-11]**.
- **RN-25** **Excesso**: se `recebido_confirmado_acumulado + recebido_agora > quantidade_contratada`, a confirmação é bloqueada, a menos que um usuário com permissão `recebimento.autorizar_excesso` registre autorização explícita com justificativa. Nesse caso o recebimento passa por `AGUARDANDO_AUTORIZACAO`; ao confirmar, gera automaticamente uma **ocorrência** `DIVERGENCIA_QUANTIDADE` aberta e auditoria. Nunca aceitar excesso silenciosamente.
- **RN-26** Recebimento a menor (parcial) é normal; o item segue com saldo a receber.
- **RN-27** Condição de entrada (`NOVO`, `BOM`, `REGULAR`, `AVARIADO`) por item recebido. `AVARIADO` exige foto e cria ocorrência `AVARIA` ao confirmar.
- **RN-28** Cancelamento de recebimento **confirmado**: só ADMIN, com justificativa, e só se nenhum bem/lote dele tiver evento posterior (movimentação, vistoria posterior, devolução, ocorrência). Bens → `CANCELADO`, lotes → `CANCELADO`. Rascunho pode ser descartado (→ `CANCELADO`) pelo autor ou ADMIN.

### 3.4 Localização e responsabilidade

- **RN-30** `local_atual_id` e `responsavel_atual_id` de bens e lotes são **cache do último evento confirmado** (recebimento ou movimentação). Só funções de domínio os alteram; o usuário não os edita diretamente (privilégio de coluna revogado) **[D-04]**.
- **RN-31** Movimentações confirmadas são imutáveis. Correção = nova movimentação com motivo "correção" referenciando a anterior.
- **RN-32** Responsável é sempre um **usuário associado à empresa** (`usuarios_empresa`) **[S-03]**.
- **RN-33** Aceite do novo responsável é configurável por empresa (`empresas.exige_aceite_movimentacao`). Com aceite: movimentação nasce `PENDENTE_ACEITE` e o bem fica `EM_TRANSFERENCIA`; local/responsável atuais só mudam no aceite. Sem aceite: confirma na hora.
- **RN-34** Movimentação parcial de lote **divide** o lote: cria lote filho (`lote_origem_id`) com a quantidade movida no destino; o lote de origem reduz `quantidade_dividida` **[D-11]**.
- **RN-35** Um bem/lote com movimentação `PENDENTE_ACEITE`, devolução aberta ou em manutenção não pode receber nova movimentação.

### 3.5 Ocorrências e troca

- **RN-40** Tipos: `AVARIA`, `DEFEITO`, `EXTRAVIO`, `TROCA`, `DIVERGENCIA_QUANTIDADE`, `DIVERGENCIA_DOCUMENTAL`, `OUTRO`. Prioridade: `BAIXA`, `MEDIA`, `ALTA`, `CRITICA`. Prazo opcional; ocorrência **vencida** = aberta/em tratamento com `prazo < agora`.
- **RN-41** Resolução exige texto de resolução; reabertura exige motivo. Ambas auditadas.
- **RN-42** **Troca** de equipamento pelo fornecedor: o bem antigo vai para `SUBSTITUIDO` (ciclo encerrado, histórico preservado); um **novo bem** é criado no mesmo item com `substitui_bem_id`, herda local e responsável, exige vistoria de entrada própria. É proibido alterar o número de série do bem antigo para "transformá-lo" no novo.
- **RN-43** **Extravio**: bem → `EXTRAVIADO` somente via ocorrência `EXTRAVIO`. Bem extraviado **continua contando no saldo** (a empresa ainda responde por ele) até a ocorrência ser resolvida como `ENCONTRADO` (volta ao estado anterior) ou `INDENIZADO` (→ `BAIXADO`) **[D-12]**. Para lotes, extravio indenizado incrementa `quantidade_baixada`.
- **RN-44** Manutenção: `EM_USO/DISPONIVEL → EM_MANUTENCAO` via ocorrência `DEFEITO`/`AVARIA`; retorno ao estado anterior ao resolver.

### 3.6 Devolução

- **RN-50** Devolução pode ser parcial ou total; pode haver várias por locação.
- **RN-51** Etapas independentes, cada uma com data, autor e evidências: **solicitação → agendamento → retirada → conferência**.
- **RN-52** Na solicitação, bens selecionados → `DEVOLUCAO_SOLICITADA`; quantidades de lote ficam **reservadas** (disponível para nova devolução = saldo − reservas abertas).
- **RN-53** **O saldo só muda na confirmação da retirada.** Na retirada informa-se, por item, a quantidade efetivamente retirada (≤ solicitada); bens não retirados voltam ao estado anterior.
- **RN-54** Retirada exige: data/hora da retirada, **nome de quem recebeu pelo fornecedor**, vistoria de saída concluída para cada bem/lote retirado (quando a categoria exigir) e condição de saída. Comprovante pode ser anexado depois; enquanto faltar, a devolução aparece em "evidências pendentes".
- **RN-55** **`RETIRADA_CONFIRMADA` NÃO encerra cobrança.** Ela apenas: atualiza saldo, marca bens como `DEVOLVIDO`, e — se o saldo da locação chegar a zero — muda `status_financeiro` para `ENCERRAMENTO_PENDENTE` (pendência para o financeiro).
- **RN-56** Toda devolução com retirada confirmada fica pendente de **ciência financeira** (`ciencia_financeira_em/por`) — o financeiro registra que tomou conhecimento da data de término de cobrança dos itens devolvidos **[D-13]**.
- **RN-57** Um bem individual não pode estar em duas devoluções não canceladas (índice único parcial).
- **RN-58** `quantidade_devolvida ≤ quantidade recebida` em lote (CHECK) e por item (validação transacional).

### 3.7 Encerramentos

- **RN-60** **Encerramento operacional** (`EM_DEVOLUCAO → ENCERRADA_OPERACIONALMENTE`): permitido apenas quando não existe bem em estado ativo (seção 5) e o saldo de todos os lotes é zero, e nenhuma devolução está em `SOLICITADA`/`AGENDADA`. Ação explícita de OPERACAO/ADMIN.
- **RN-61** **Encerramento financeiro** (`ENCERRAMENTO_PENDENTE → ENCERRADO`): ação explícita de FINANCEIRO/ADMIN, com `data_encerramento_financeiro` informada, exige que nenhuma cobrança esteja `PENDENTE` ou `DIVERGENTE`. **Não depende** do encerramento operacional e **não o dispara**.
- **RN-62** Os dois encerramentos são campos, estados, permissões, funções e eventos de auditoria distintos. Nenhum trigger encadeia um ao outro.

### 3.8 Cobrança

- **RN-70** Cobrança registra: competência (início/fim), valor cobrado (`numeric(14,2)`), número do documento, anexo, observação.
- **RN-71** Status: `PENDENTE → CONFERIDA`; `PENDENTE → DIVERGENTE → RESOLVIDA`; `CONFERIDA → DIVERGENTE` (com motivo). Divergente exige motivo; resolvida exige resolução.
- **RN-72** O sistema pode exibir uma **estimativa** do valor do período, calculada a partir de itens, valores unitários, datas de recebimento e retirada. Toda estimativa é rotulada: _"Estimativa operacional — não substitui nota fiscal, fatura, boleto ou confirmação financeira."_
- **RN-73** Regra de estimativa: diária = valor/1 dia; semanal = valor/7; quinzenal = valor/15; mensal = valor/30 por dia de posse (dia comercial) **[S-04]**. Arredondamento só na exibição; cálculo com `numeric`.
- **RN-74** Primeira cobrança registrada leva `status_financeiro` de `NAO_INICIADO` para `EM_COBRANCA`.

### 3.9 Checklists e vistorias

- **RN-80** Modelos de checklist são versionados: `(empresa_id, familia_id, versao)`. Versão `PUBLICADA` é imutável (trigger). Alterar = criar nova versão.
- **RN-81** Vistoria referencia a versão exata do modelo; respostas referenciam perguntas daquela versão — mudanças futuras não alteram vistorias passadas.
- **RN-82** Pergunta: `ordem`, `texto`, `tipo_resposta` (`SIM_NAO`, `CONFORME_NAO_CONFORME`, `OPCAO_UNICA`, `TEXTO`, `NUMERO`), `obrigatoria`, `exige_foto_se` (`SEMPRE`, `NUNCA`, ou lista de respostas que exigem foto, ex.: `NAO_CONFORME`).
- **RN-83** Vistoria só é concluída se todas as obrigatórias foram respondidas e todas as fotos exigidas anexadas. Vistoria concluída é imutável.
- **RN-84** Tipos de vistoria: `ENTRADA` (recebimento), `PERIODICA`, `SAIDA` (devolução), `OCORRENCIA`.

### 3.10 Evidências

- **RN-90** Buckets privados: `evidencias`, `contratos`, `comprovantes`, `relatorios`.
- **RN-91** Caminho físico: `{empresa_id}/{entidade_tipo}/{entidade_id}/{uuid}.{ext}`. Nome original só como metadado.
- **RN-92** Validação no servidor: MIME real por _magic bytes_, extensão coerente, tamanho (imagem ≤ 15 MB, PDF ≤ 20 MB — configurável), tipo permitido por contexto, autorização sobre a entidade, mesma empresa.
- **RN-93** SHA-256 calculado no servidor. `capturada_em` (informada pelo dispositivo, rotulada como tal) ≠ `enviada_em` (servidor).
- **RN-94** Nunca persistir URL assinada; só `storage_path`. URL assinada (validade curta, 5 min) só é gerada após confirmar acesso à entidade.
- **RN-95** Evidência nunca é apagada pelo fluxo normal: substituição (`SUBSTITUIDA`, aponta para a nova) ou remoção lógica (`REMOVIDA`, com motivo). Ambas auditadas.

### 3.11 Datas, moeda e atrasos

- **RN-100** Persistência em UTC (`timestamptz`). Exibição no fuso da empresa (`empresas.timezone`, padrão `America/Sao_Paulo`), formato `dd/MM/yyyy HH:mm`.
- **RN-101** Dinheiro: `numeric(14,2)` no banco; strings decimais no transporte; nunca `float` em cálculo. Exibição `pt-BR` (`R$ 1.234,56`).
- **RN-102** `data_evento` não pode estar no futuro (tolerância 5 min) e não pode ser anterior ao início efetivo da locação.
- **RN-103** Registros com `created_at − data_evento > empresas.limite_atraso_horas` (padrão 24) são exibidos com selo **"Lançado com atraso"**.

### 3.12 Relatórios

- **RN-110** PDF gerado no servidor a partir dos dados persistidos no momento da geração; registra versão do template, data de geração, usuário gerador, hash SHA-256 do snapshot de dados (impresso no PDF) e hash do arquivo (no banco) **[D-16]**.
- **RN-111** Geração assíncrona com estados `PENDENTE → PROCESSANDO → CONCLUIDO | ERRO`. Nenhuma requisição HTTP fica bloqueada aguardando o PDF.
- **RN-112** Relatório é imutável; nova geração = nova versão.

---

## 4. Máquinas de estado

Regra geral: **nenhuma tela ou chamada escreve status livremente**. Coluna `status` não é atualizável pelo papel `authenticated` (privilégio de coluna revogado); só funções de domínio a alteram, e o trigger `privado.guardar_transicao` rejeita qualquer transição fora da tabela `privado.transicoes`, mesmo vinda de função ou do superusuário **[D-04]**.

**Fonte de verdade:** `supabase/migrations/20261008120000_fundacao_tipos.sql` (tabela `privado.transicoes`). Cópia TypeScript em `src/features/*/rules/maquina-estado.ts`; o teste `tests/integration/paridade.test.ts` falha se divergirem. Os diagramas abaixo são explicativos; em caso de dúvida, vale a tabela.

### 4.1 Locação (`locacoes.status`)

```
RASCUNHO ──ativar──▶ ATIVA ──iniciar_desmobilizacao──▶ EM_DEVOLUCAO ──encerrar_operacional──▶ ENCERRADA_OPERACIONALMENTE
   │                   │                                  │
   └──cancelar──▶ CANCELADA ◀──cancelar (sem receb.)──┘  └──(sistema) devolução total cancelada──▶ ATIVA
```

| De           | Para                       | Ação                                                                                                  | Quem            | Pré-condições                                   |
| ------------ | -------------------------- | ----------------------------------------------------------------------------------------------------- | --------------- | ----------------------------------------------- |
| RASCUNHO     | ATIVA                      | `locacao.ativar`                                                                                      | ADMIN, COMPRAS  | RN-13                                           |
| RASCUNHO     | CANCELADA                  | `locacao.cancelar`                                                                                    | ADMIN, COMPRAS  | motivo                                          |
| ATIVA        | CANCELADA                  | `locacao.cancelar`                                                                                    | ADMIN, COMPRAS  | nenhum recebimento CONFIRMADO; motivo           |
| ATIVA        | EM_DEVOLUCAO               | `locacao.iniciar_desmobilizacao` ou automático ao solicitar devolução que cubra todo o saldo restante | ADMIN, OPERACAO | —                                               |
| EM_DEVOLUCAO | ATIVA                      | automático ao cancelar a devolução que causou a desmobilização **[D-15]**                             | sistema         | nenhuma outra devolução aberta cobrindo o saldo |
| EM_DEVOLUCAO | ENCERRADA_OPERACIONALMENTE | `locacao.encerrar_operacional`                                                                        | ADMIN, OPERACAO | RN-60                                           |

Estados terminais: `ENCERRADA_OPERACIONALMENTE`, `CANCELADA`.

### 4.2 Financeiro da locação (`locacoes.status_financeiro`)

```
NAO_INICIADO ──1ª cobrança──▶ EM_COBRANCA ──saldo zerado na retirada──▶ ENCERRAMENTO_PENDENTE ──confirmar──▶ ENCERRADO
      └────────────saldo zerado sem cobrança registrada────────────────▶ ENCERRAMENTO_PENDENTE
```

| De                         | Para                  | Gatilho                                                                         | Quem              |
| -------------------------- | --------------------- | ------------------------------------------------------------------------------- | ----------------- |
| NAO_INICIADO               | EM_COBRANCA           | registro da 1ª cobrança                                                         | ADMIN, FINANCEIRO |
| NAO_INICIADO / EM_COBRANCA | ENCERRAMENTO_PENDENTE | retirada confirmada que zera o saldo (função de devolução)                      | sistema           |
| ENCERRAMENTO_PENDENTE      | EM_COBRANCA           | saldo volta a ser > 0 (ex.: cancelamento administrativo de retirada) **[D-15]** | sistema           |
| ENCERRAMENTO_PENDENTE      | ENCERRADO             | `locacao.encerrar_financeiro` com data                                          | ADMIN, FINANCEIRO |

Terminal: `ENCERRADO`. Nenhuma transição financeira altera `locacoes.status`, e vice-versa.

### 4.3 Bem (`bens.status`)

Estados da especificação + extensões **[D-12]** (em itálico):

```
AGUARDANDO_RECEBIMENTO ──confirmar receb.──▶ DISPONIVEL ──alocar──▶ EM_USO
         └─cancelar receb.─▶ *CANCELADO*

EM_USO ──mov. c/ aceite──▶ EM_TRANSFERENCIA ──aceite──▶ EM_USO   (recusa/cancelamento → EM_USO no local de origem)
EM_USO | DISPONIVEL ──solicitar devolução──▶ DEVOLUCAO_SOLICITADA ──retirada──▶ DEVOLVIDO
                                       └─cancelar dev./não retirado─▶ (estado anterior)
EM_USO | DISPONIVEL ──ocorrência defeito/avaria──▶ EM_MANUTENCAO ──resolver──▶ (estado anterior)
{DISPONIVEL, EM_USO, EM_TRANSFERENCIA, EM_MANUTENCAO, DEVOLUCAO_SOLICITADA} ──ocorrência EXTRAVIO──▶ EXTRAVIADO
EXTRAVIADO ──resolvida ENCONTRADO──▶ (estado anterior) | ──resolvida INDENIZADO──▶ *BAIXADO*
{DISPONIVEL, EM_USO, EM_MANUTENCAO} ──troca──▶ *SUBSTITUIDO*
{DISPONIVEL, EM_USO} ──cancelamento de recebimento confirmado (RN-28)──▶ *CANCELADO*
```

Transições completas (fonte: `privado.transicoes`):

| De                                         | Para                                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| AGUARDANDO_RECEBIMENTO                     | DISPONIVEL, CANCELADO                                                                                        |
| DISPONIVEL                                 | EM_USO, DEVOLUCAO_SOLICITADA, EM_MANUTENCAO, EXTRAVIADO, SUBSTITUIDO, CANCELADO                              |
| EM_USO                                     | EM_TRANSFERENCIA, DEVOLUCAO_SOLICITADA, EM_MANUTENCAO, EXTRAVIADO, SUBSTITUIDO, CANCELADO                    |
| EM_TRANSFERENCIA                           | EM_USO, EXTRAVIADO                                                                                           |
| EM_MANUTENCAO                              | EM_USO, DISPONIVEL, EXTRAVIADO, SUBSTITUIDO                                                                  |
| DEVOLUCAO_SOLICITADA                       | DEVOLVIDO, EM_USO, DISPONIVEL, EXTRAVIADO                                                                    |
| EXTRAVIADO                                 | DISPONIVEL, EM_USO, EM_MANUTENCAO, DEVOLUCAO_SOLICITADA (encontrado → estado anterior), BAIXADO (indenizado) |
| DEVOLVIDO, SUBSTITUIDO, BAIXADO, CANCELADO | — (finais)                                                                                                   |

| Estado                 | Ativo (conta no saldo)?  | Terminal? |
| ---------------------- | ------------------------ | --------- |
| AGUARDANDO_RECEBIMENTO | não (ainda não recebido) | não       |
| DISPONIVEL             | sim                      | não       |
| EM_USO                 | sim                      | não       |
| EM_TRANSFERENCIA       | sim                      | não       |
| EM_MANUTENCAO          | sim                      | não       |
| DEVOLUCAO_SOLICITADA   | sim                      | não       |
| EXTRAVIADO             | **sim**                  | não       |
| DEVOLVIDO              | não                      | sim       |
| _SUBSTITUIDO_          | não                      | sim       |
| _BAIXADO_              | não                      | sim       |
| _CANCELADO_            | não                      | sim       |

"Estado anterior" é guardado no evento que causou a transição (`itens_devolucao.status_anterior_bem`, `ocorrencias.status_anterior_bem`), nunca inferido.

### 4.4 Lote (`lotes.status`)

`ATIVO` (saldo > 0) → `ENCERRADO` (saldo = 0) ; `ATIVO → CANCELADO` (cancelamento do recebimento) ; `ENCERRADO → ATIVO` (somente cancelamento administrativo de retirada — D-15). O banco garante por CHECK que `ATIVO ⇔ saldo > 0` (exceto CANCELADO). Lote não tem estados de uso: suas quantidades e local/responsável é que mudam.

### 4.5 Recebimento (`recebimentos.status`)

```
RASCUNHO ──confirmar (sem excesso)──▶ CONFIRMADO ──cancelar (ADMIN, RN-28)──▶ CANCELADO
RASCUNHO ──enviar p/ autorização (excesso)──▶ AGUARDANDO_AUTORIZACAO ──autorizar + confirmar──▶ CONFIRMADO
                                                 └──rejeitar──▶ RASCUNHO
RASCUNHO | AGUARDANDO_AUTORIZACAO ──descartar──▶ CANCELADO
```

### 4.6 Vistoria (`vistorias.status`)

`RASCUNHO → CONCLUIDA` (RN-83) ; `RASCUNHO → CANCELADA`. Concluída é imutável.

### 4.7 Movimentação (`movimentacoes.status`)

`PENDENTE_ACEITE → CONFIRMADA | RECUSADA | CANCELADA` ; criação direta como `CONFIRMADA` quando a empresa não exige aceite. CONFIRMADA é terminal e imutável.

### 4.8 Ocorrência (`ocorrencias.status`)

`ABERTA → EM_TRATAMENTO → RESOLVIDA` ; `ABERTA → RESOLVIDA` ; `RESOLVIDA → ABERTA` (reabertura com motivo) ; `ABERTA | EM_TRATAMENTO → CANCELADA` (com motivo; não permitido se gerou troca ou extravio já aplicado).

### 4.9 Devolução (`devolucoes.status`)

```
RASCUNHO ──solicitar──▶ SOLICITADA ──agendar──▶ AGENDADA ──confirmar retirada──▶ RETIRADA_CONFIRMADA ──conferir──▶ CONFERIDA
                           │                       │
                           └──cancelar──▶ CANCELADA ◀──cancelar──┘
RASCUNHO ──descartar──▶ CANCELADA
```

Agendamento pode ser reagendado (novo evento, data anterior preservada em histórico). `SOLICITADA → RETIRADA_CONFIRMADA` direto **não** é permitido: retirada sem agendamento registra agendamento com a mesma data num único passo explícito da UI ("retirada imediata"), preservando as duas etapas.

### 4.10 Cobrança (`cobrancas.status`)

`PENDENTE → CONFERIDA` ; `PENDENTE | CONFERIDA → DIVERGENTE` ; `DIVERGENTE → RESOLVIDA`.

### 4.11 Relatório (`relatorios.status`)

`PENDENTE → PROCESSANDO → CONCLUIDO | ERRO` ; `ERRO → PENDENTE` (nova tentativa, máx. 3) ; `PROCESSANDO` há mais de 10 min → `ERRO` (watchdog).

---

## 5. Cálculos

### 5.1 Saldo

- **Bem ativo**: status ∈ {DISPONIVEL, EM_USO, EM_TRANSFERENCIA, EM_MANUTENCAO, DEVOLUCAO_SOLICITADA, EXTRAVIADO}.
- **Saldo do lote** = `quantidade_recebida − quantidade_devolvida − quantidade_dividida − quantidade_baixada` (≥ 0 por CHECK). Lote filho de divisão nasce com `quantidade_recebida` = quantidade movida e `lote_origem_id` preenchido.
- **Saldo do item INDIVIDUAL** = nº de bens ativos do item.
- **Saldo do item LOTE** = Σ saldo dos lotes `ATIVO` do item.
- **Recebido do item** (para teste de excesso): INDIVIDUAL = nº de bens com status ∉ {AGUARDANDO_RECEBIMENTO, CANCELADO} **e** `substitui_bem_id is null` (o substituto ocupa a vaga do substituído, logo troca não gera excesso); LOTE = Σ `quantidade_recebida` dos lotes raiz (`lote_origem_id is null`) não cancelados.
- **Disponível para devolução (lote)** = saldo − Σ quantidades em itens de devoluções `SOLICITADA/AGENDADA`.
- **Saldo da locação** = Σ saldo dos itens. Elegível a encerramento operacional ⇔ saldo = 0 ∧ sem devolução aberta.

Cálculos ficam em **visões SQL** (`v_saldo_lote`, `v_saldo_item_locacao`, `v_saldo_locacao`) e em funções puras TypeScript espelhadas e testadas **[D-10]**. As funções transacionais travam (`SELECT … FOR UPDATE`) o item/lote antes de validar.

### 5.2 Indicadores do dashboard (regra de cálculo explícita, exibida em tooltip)

| Indicador                           | Regra                                                                                                | Destino do clique                                                      |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Locações ativas                     | `status ∈ {ATIVA, EM_DEVOLUCAO}`                                                                     | `/locacoes?status=ATIVA,EM_DEVOLUCAO`                                  |
| Bens ativos                         | bens com status ativo (5.1)                                                                          | `/bens?situacao=ativos`                                                |
| Saldo de lotes                      | Σ saldo dos lotes ATIVO (quantidade, por unidade de medida)                                          | `/bens?tipo=lote&situacao=ativos`                                      |
| Términos em 7/15/30 dias            | locações ATIVA/EM_DEVOLUCAO com `termino_previsto` entre hoje e hoje+N (fuso da empresa), cumulativo | `/locacoes?termino_ate=N`                                              |
| Términos vencidos                   | `termino_previsto < hoje` e saldo > 0                                                                | `/locacoes?termino=vencido`                                            |
| Devoluções aguardando retirada      | devoluções `SOLICITADA` ou `AGENDADA`                                                                | `/devolucoes?status=SOLICITADA,AGENDADA`                               |
| Vistorias incompletas               | vistorias `RASCUNHO`                                                                                 | `/vistorias?status=RASCUNHO`                                           |
| Evidências pendentes                | devoluções `RETIRADA_CONFIRMADA/CONFERIDA` sem comprovante ativo + cobranças sem documento anexo     | `/devolucoes?pendencia=comprovante` / `/cobrancas?pendencia=documento` |
| Ocorrências abertas                 | `status ∈ {ABERTA, EM_TRATAMENTO}`                                                                   | `/ocorrencias?status=ABERTA,EM_TRATAMENTO`                             |
| Ocorrências vencidas                | abertas com `prazo < agora`                                                                          | `/ocorrencias?vencidas=1`                                              |
| Divergências financeiras            | cobranças `DIVERGENTE`                                                                               | `/cobrancas?status=DIVERGENTE`                                         |
| Encerramentos financeiros pendentes | locações `status_financeiro = ENCERRAMENTO_PENDENTE` + devoluções sem ciência financeira             | `/cobrancas?pendencia=encerramento`                                    |
| Movimentações aguardando aceite     | `PENDENTE_ACEITE` (para RESPONSAVEL_LOCAL: as destinadas a ele)                                      | `/movimentacoes?status=PENDENTE_ACEITE`                                |

Para RESPONSAVEL_LOCAL, todos os indicadores são restritos aos itens sob sua responsabilidade.

---

## 6. Fluxos principais (resumo)

1. **Compras** cria locação (rascunho) → informa fornecedor, centro de custo, vigência → adiciona referências Sectra → adiciona itens (individuais e lote) → revisa → **ativa**.
2. **Operação** (celular) inicia recebimento → seleciona itens → informa quantidade / cadastra bens → identificação física → checklist → fotos → local → responsável → revisa → **confirma** (transação).
3. **Operação** movimenta bem/lote → (aceite do novo responsável, se exigido) → local/responsável atualizados.
4. Qualquer perfil autorizado registra **ocorrência**; Operação trata, resolve, registra troca.
5. **Operação** solicita devolução → agenda → confirma retirada (vistoria de saída, recebedor do fornecedor, comprovante) → confere.
6. Saldo zero → `ENCERRAMENTO_PENDENTE` no financeiro; Operação encerra operacionalmente.
7. **Financeiro** registra/confere cobranças, dá ciência das devoluções e **confirma encerramento financeiro** com data.
8. Qualquer perfil de leitura autorizado gera **relatório PDF**.

---

## 7. Critérios de aceite (verificáveis)

Formato: **CA-xx** — _Dado / Quando / Então_ — e o tipo de teste que prova.

### Segurança e multiempresa

- **CA-01** Dado usuário ativo da Empresa A, quando consulta locações, então só vê registros de A. _(RLS + E2E)_
- **CA-02** Dado usuário da Empresa A, quando faz `select/insert/update` em qualquer tabela operacional com `empresa_id` de B (via API REST do Supabase com seu JWT), então recebe 0 linhas / erro de policy. _(RLS)_
- **CA-03** Dado usuário com associação inativa, quando acessa qualquer rota privada, então é redirecionado e o banco retorna 0 linhas. _(RLS + E2E)_
- **CA-04** Dado usuário anônimo, quando chama a API REST de qualquer tabela, então 0 linhas / negado. _(RLS)_
- **CA-05** Dado AUDITOR, quando tenta qualquer mutação operacional (tabela ou função), então é negado no servidor **e** no banco. _(unit + RLS + E2E)_
- **CA-06** O bundle do navegador não contém `SUPABASE_SERVICE_ROLE_KEY` nem `REPORT_SIGNING_SECRET` (verificado por varredura do `.next/static` no CI). _(CI)_
- **CA-07** Dado usuário de A, quando pede `/api/files/{id}` de evidência de B, então 404 e nenhuma URL assinada é gerada. _(integração + E2E)_
- **CA-08** Dado usuário autenticado, quando tenta `update locacoes set status='ENCERRADA_OPERACIONALMENTE'` direto pela API, então é negado (privilégio de coluna). _(RLS)_

### Locação

- **CA-10** COMPRAS cria locação com pedido Sectra, 1 item INDIVIDUAL e 1 item LOTE, e ativa; dados persistidos e visíveis após recarregar. _(E2E)_
- **CA-11** Ativação sem referência SECTRA PEDIDO é rejeitada com mensagem no campo. _(unit + integração)_
- **CA-12** Mesmo pedido Sectra em duas locações da mesma empresa é rejeitado; em empresas diferentes é aceito. _(integração)_
- **CA-13** Busca por código, pedido Sectra, fornecedor, local, centro de custo, status, período e identificação de bem retorna resultados paginados (25/50/100) no servidor, com filtros preservados na URL. _(integração + E2E)_

### Recebimento

- **CA-20** Recebimento parcial de lote (60 de 100) gera lote com saldo 60 e item com 40 a receber. _(integração)_
- **CA-21** Recebimento total fecha "a receber" do item em 0. _(integração)_
- **CA-22** Excesso sem autorização → confirmação bloqueada. _(integração)_
- **CA-23** Excesso com autorização (perfil + justificativa) → confirmado, ocorrência `DIVERGENCIA_QUANTIDADE` criada, auditoria gravada. _(integração)_
- **CA-24** Antes da confirmação, nenhum bem/lote aparece como ativo nem altera saldo. _(integração)_
- **CA-25** Recebimento completo executável em viewport 375 px, com câmera (input `capture`), sem rolagem horizontal. _(E2E mobile)_
- **CA-26** Falha no meio da confirmação (ex.: foto obrigatória ausente) não deixa nenhum efeito parcial (transação). _(integração)_

### Evidências

- **CA-30** Upload de arquivo com extensão `.jpg` mas conteúdo PDF/HTML é rejeitado. _(integração)_
- **CA-31** Arquivo armazenado em `{empresa}/{tipo}/{entidade}/{uuid}.{ext}`, com SHA-256 correto; `nome_original` só em metadado. _(integração)_
- **CA-32** Banco não contém nenhuma URL assinada (busca por `token=` em colunas texto). _(integração)_
- **CA-33** Substituição e remoção lógica preservam o arquivo e o registro anterior e geram auditoria. _(integração)_

### Movimentação, ocorrência, troca

- **CA-40** Movimentação confirmada atualiza local e responsável atuais; a anterior permanece intacta na timeline. _(integração + E2E)_
- **CA-41** Com aceite exigido, local/responsável só mudam após aceite do novo responsável; recusa mantém origem. _(integração)_
- **CA-42** Movimentação parcial de lote cria lote filho e preserva soma das quantidades. _(integração)_
- **CA-43** Troca cria novo bem vinculado; bem antigo `SUBSTITUIDO` com número de série inalterado e timeline completa. _(integração)_
- **CA-44** Ocorrência resolvida e reaberta registra motivo, ator e data em ambas as operações. _(integração)_

### Devolução e financeiro

- **CA-50** Devolução parcial de 30 de um lote de 60 só altera o saldo (para 30) após `RETIRADA_CONFIRMADA`. _(integração)_
- **CA-51** `RETIRADA_CONFIRMADA` não altera `status_financeiro` para `ENCERRADO` em nenhum caso. _(integração)_
- **CA-52** Retirada final que zera saldo → `status_financeiro = ENCERRAMENTO_PENDENTE`; locação permite encerramento operacional. _(integração)_
- **CA-53** Encerramento operacional com bem ativo ou saldo de lote > 0 é rejeitado. _(unit + integração)_
- **CA-54** Encerramento financeiro só por FINANCEIRO/ADMIN, com data, e com cobranças sem PENDENTE/DIVERGENTE. _(unit + integração + E2E)_
- **CA-55** Encerramento operacional não altera status financeiro, e encerramento financeiro não altera status operacional. _(integração)_
- **CA-56** Estimativa exibe o aviso de que não substitui documento fiscal. _(E2E)_

### Auditoria

- **CA-60** Cada operação crítica listada em `docs/architecture.md §8` grava linha de auditoria na mesma transação, com ator, empresa, ação, entidade, antes/depois e `request_id`. _(integração)_
- **CA-61** Auditoria não contém campos de senha, token ou binário (teste de varredura das chaves JSON). _(integração)_
- **CA-62** Nenhum perfil consegue `update`/`delete` em `auditoria`. _(RLS)_

### Relatórios e dashboard

- **CA-70** Relatório de locação contém todas as seções da especificação, fotos com legenda (evento, item, data, local, usuário), versão, data, gerador e hash. _(integração: parse do PDF)_
- **CA-71** Pedido de relatório retorna imediatamente com status `PENDENTE`; a UI acompanha até `CONCLUIDO`. _(E2E)_
- **CA-72** Cada indicador do dashboard abre a lista filtrada correspondente e o número da lista bate com o indicador. _(E2E)_

### UX / acessibilidade

- **CA-80** Telas principais sem rolagem horizontal em 375 px, 768 px e 1280 px. _(E2E visual)_
- **CA-81** Alvos de toque ≥ 44×44 px; texto principal ≥ 16 px; contraste AA (axe sem violações sérias). _(E2E + axe)_
- **CA-82** Fluxos críticos completáveis só com teclado; foco visível. _(E2E)_
- **CA-83** Datas `dd/MM/yyyy HH:mm` no fuso da empresa; valores `pt-BR`. _(unit)_

---

## 8. Fora do escopo do MVP

Edição no Sectra; API do Sectra; app nativo; offline completo; OCR; detecção de avarias por IA; ERP/contabilidade/contas a pagar; billing do próprio SaaS; planos; portal do fornecedor; cadastro self-service de empresas (provisionamento é feito por script do operador da plataforma **[D-17]**).

---

## 11. Suposições (todas **validadas e aceitas** pelo responsável em 2026-10-08)

| ID   | Suposição adotada (aceita)                                                                              | Alternativa caso mude no futuro                                                                                                      |
| ---- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| S-01 | Ativação exige ao menos um **pedido** Sectra. Locações emergenciais sem pedido ficam em RASCUNHO.       | Se houver locação legítima sem pedido, criar flag "sem pedido — justificativa".                                                      |
| S-02 | Um pedido Sectra origina **no máximo uma** locação na empresa.                                          | Se um pedido gerar várias locações (ex.: por fornecedor/obra), relaxar o unique para `(empresa, sistema, tipo, numero, locacao_id)`. |
| S-03 | Responsável por um bem é sempre um **usuário do sistema** (pode ter perfil RESPONSAVEL_LOCAL).          | Se responsáveis forem pessoas sem login, criar cadastro `responsaveis` (pessoa) com `user_id` opcional.                              |
| S-04 | Estimativa mensal pro rata em 30 dias.                                                                  | Ajustar fórmula; não afeta dados persistidos.                                                                                        |
| S-05 | RESPONSAVEL_LOCAL pode registrar ocorrência sobre itens sob sua responsabilidade.                       | Remover a permissão.                                                                                                                 |
| S-06 | Bem `DISPONIVEL` (recebido mas não alocado) pode ser devolvido, transferido ou ir para manutenção.      | Restringir a EM_USO conforme texto literal.                                                                                          |
| S-07 | Um usuário tem **um papel por empresa**; pode pertencer a várias empresas.                              | Se precisar de múltiplos papéis, mudar `usuarios_empresa.papel` para array — a matriz já é por permissão, não por papel.             |
| S-08 | Valores do contrato (valor unitário) são visíveis a todos os perfis internos, exceto RESPONSAVEL_LOCAL. | Restringir a COMPRAS/FINANCEIRO/GESTOR/ADMIN/AUDITOR.                                                                                |
| S-09 | Limite de atraso de lançamento = 24 h.                                                                  | Configurável por empresa.                                                                                                            |
| S-10 | Fotos são armazenadas no original (sem recompressão) para preservar o hash; limite 15 MB.               | Se o custo de storage pesar, recomprimir no cliente antes do upload (o hash passa a ser do arquivo recomprimido).                    |

### Insumos recomendados (da própria especificação, "Orientação ao responsável")

Exemplos reais anonimizados de: pedido Sectra, relatório fotográfico atual, comprovante de retirada, categorias de equipamentos e checklist utilizado. Sem eles, os campos acima seguem as suposições e o PDF segue um layout genérico.
