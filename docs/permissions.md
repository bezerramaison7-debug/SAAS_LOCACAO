# Permissões — matriz de autorização

> Fonte de verdade em código: `src/lib/permissions/matriz.ts`. Espelho no banco: `privado.papel_permissoes` (migration `20261008120100`). `tests/integration/paridade.test.ts` falha se as duas divergirem. Permissões auxiliares de leitura: `dados.ler_geral` (todos exceto RESPONSAVEL_LOCAL) e `valores.ver` (idem, S-08).
> A mesma permissão é verificada em **três lugares**: UI (`can()`), servidor (`exigirPermissao()`), banco (`usuario_tem_permissao()` em policies e `rpc_*`). Storage tem policy própria.

## 1. Papéis

| Papel               | Escopo                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------- |
| `ADMIN`             | Configurações, usuários e todas as operações da empresa.                                                   |
| `COMPRAS`           | Locações, referências Sectra, fornecedores, contratos, itens contratados; autoriza excesso de recebimento. |
| `OPERACAO`          | Recebimentos, bens, lotes, vistorias, movimentações, ocorrências, devoluções, encerramento operacional.    |
| `RESPONSAVEL_LOCAL` | Consulta e aceite dos itens **sob sua responsabilidade**; registra ocorrência sobre eles [S-05].           |
| `FINANCEIRO`        | Cobranças, divergências, ciência de devoluções, encerramento financeiro.                                   |
| `GESTOR`            | Consulta geral, dashboards, indicadores, relatórios, auditoria (leitura).                                  |
| `AUDITOR`           | Leitura geral e histórico; gera relatórios; **nenhuma mutação operacional**.                               |

Um usuário tem **um papel por empresa** (`usuarios_empresa.papel`) e pode pertencer a várias empresas [S-07]. Usuário com associação `ativo = false` não tem nenhuma permissão naquela empresa.

## 2. Escopo de leitura

| Papel                                                 | Leitura                                                                                                                                                                                                                           |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADMIN, COMPRAS, OPERACAO, FINANCEIRO, GESTOR, AUDITOR | Todos os dados operacionais da empresa.                                                                                                                                                                                           |
| RESPONSAVEL_LOCAL                                     | Bens/lotes onde é responsável atual **ou** destinatário de movimentação pendente; seus eventos (movimentações, vistorias, ocorrências, evidências desses itens); cabeçalho resumido da locação desses itens (sem valores [S-08]). |
| Auditoria (`auditoria`)                               | ADMIN, GESTOR, AUDITOR.                                                                                                                                                                                                           |
| Usuários da empresa                                   | Todos veem nome dos membros (necessário para escolher responsável); só ADMIN vê/edita papel, status e e-mail.                                                                                                                     |

## 3. Matriz de permissões (ações)

Legenda: ✅ permitido · 🔸 permitido com escopo restrito (ver nota) · — negado

| Permissão                                                                | ADMIN | COMPRAS | OPERACAO | RESP_LOCAL | FINANCEIRO | GESTOR | AUDITOR |
| ------------------------------------------------------------------------ | :---: | :-----: | :------: | :--------: | :--------: | :----: | :-----: |
| **Empresa / usuários**                                                   |       |         |          |            |            |        |         |
| `empresa.configurar`                                                     |  ✅   |    —    |    —     |     —      |     —      |   —    |    —    |
| `usuarios.gerenciar` (convidar, papel, ativar/desativar)                 |  ✅   |    —    |    —     |     —      |     —      |   —    |    —    |
| `auditoria.ler`                                                          |  ✅   |    —    |    —     |     —      |     —      |   ✅   |   ✅    |
| **Cadastros**                                                            |       |         |          |            |            |        |         |
| `fornecedor.gerenciar`                                                   |  ✅   |   ✅    |    —     |     —      |     —      |   —    |    —    |
| `local.gerenciar`                                                        |  ✅   |   ✅    |    ✅    |     —      |     —      |   —    |    —    |
| `centro_custo.gerenciar`                                                 |  ✅   |   ✅    |    —     |     —      |     ✅     |   —    |    —    |
| `categoria.gerenciar`                                                    |  ✅   |   ✅    |    —     |     —      |     —      |   —    |    —    |
| `checklist.gerenciar` (criar versão, publicar)                           |  ✅   |    —    |    ✅    |     —      |     —      |   —    |    —    |
| **Locação**                                                              |       |         |          |            |            |        |         |
| `locacao.criar` / `locacao.editar` (rascunho; aditivo com motivo)        |  ✅   |   ✅    |    —     |     —      |     —      |   —    |    —    |
| `locacao.referencia.gerenciar`                                           |  ✅   |   ✅    |    —     |     —      |     —      |   —    |    —    |
| `locacao.ativar`                                                         |  ✅   |   ✅    |    —     |     —      |     —      |   —    |    —    |
| `locacao.cancelar`                                                       |  ✅   |   ✅    |    —     |     —      |     —      |   —    |    —    |
| `locacao.iniciar_desmobilizacao`                                         |  ✅   |    —    |    ✅    |     —      |     —      |   —    |    —    |
| `locacao.encerrar_operacional`                                           |  ✅   |    —    |    ✅    |     —      |     —      |   —    |    —    |
| `locacao.encerrar_financeiro`                                            |  ✅   |    —    |    —     |     —      |     ✅     |   —    |    —    |
| **Recebimento**                                                          |       |         |          |            |            |        |         |
| `recebimento.registrar` (rascunho, editar, confirmar sem excesso)        |  ✅   |    —    |    ✅    |     —      |     —      |   —    |    —    |
| `recebimento.autorizar_excesso`                                          |  ✅   |   ✅    |    —     |     —      |     —      |   —    |    —    |
| `recebimento.cancelar_confirmado`                                        |  ✅   |    —    |    —     |     —      |     —      |   —    |    —    |
| **Vistoria**                                                             |       |         |          |            |            |        |         |
| `vistoria.registrar`                                                     |  ✅   |    —    |    ✅    |     —      |     —      |   —    |    —    |
| **Movimentação**                                                         |       |         |          |            |            |        |         |
| `movimentacao.registrar`                                                 |  ✅   |    —    |    ✅    |     —      |     —      |   —    |    —    |
| `movimentacao.aceitar` (próprio destinatário)                            |  🔸¹  |   🔸²   |   🔸²    |    🔸²     |    🔸²     |  🔸²   |    —    |
| **Ocorrência**                                                           |       |         |          |            |            |        |         |
| `ocorrencia.registrar`                                                   |  ✅   |   ✅    |    ✅    |    🔸³     |    ✅⁴     |   —    |    —    |
| `ocorrencia.tratar` (em tratamento, resolver, reabrir, cancelar)         |  ✅   |    —    |    ✅    |     —      |     —      |   —    |    —    |
| `troca.registrar`                                                        |  ✅   |    —    |    ✅    |     —      |     —      |   —    |    —    |
| **Devolução**                                                            |       |         |          |            |            |        |         |
| `devolucao.gerenciar` (solicitar, agendar, retirada, conferir, cancelar) |  ✅   |    —    |    ✅    |     —      |     —      |   —    |    —    |
| `devolucao.ciencia_financeira`                                           |  ✅   |    —    |    —     |     —      |     ✅     |   —    |    —    |
| **Cobrança**                                                             |       |         |          |            |            |        |         |
| `cobranca.gerenciar` (registrar, conferir, divergente, resolver)         |  ✅   |    —    |    —     |     —      |     ✅     |   —    |    —    |
| `cobranca.ver_estimativa`                                                |  ✅   |   ✅    |    —     |     —      |     ✅     |   ✅   |   ✅    |
| **Evidências**                                                           |       |         |          |            |            |        |         |
| `evidencia.enviar` (sobre entidade que o papel pode mutar)               |  ✅   |   ✅⁵   |    ✅    |    🔸³     |    ✅⁵     |   —    |    —    |
| `evidencia.substituir_remover` (com motivo)                              |  ✅   |    —    |    ✅    |     —      |     —      |   —    |    —    |
| **Relatórios**                                                           |       |         |          |            |            |        |         |
| `relatorio.gerar`                                                        |  ✅   |   ✅    |    ✅    |     —      |     ✅     |   ✅   |   ✅    |

Notas:

1. ADMIN pode registrar **aceite administrativo** em nome do destinatário, com justificativa obrigatória e auditoria explícita.
2. Qualquer usuário ativo pode aceitar/recusar **somente** movimentações em que é `novo_responsavel_id`. AUDITOR não pode ser responsável por itens.
3. Somente sobre bens/lotes sob sua responsabilidade atual.
4. FINANCEIRO registra ocorrências do tipo `DIVERGENCIA_DOCUMENTAL`.
5. COMPRAS: contratos/documentos de locação e referências; FINANCEIRO: documentos de cobrança.

## 4. Matriz por tabela (banco — RLS + grants)

`S` = select, `I` = insert, `U` = update (só colunas concedidas), `RPC` = só via função de domínio. Nenhuma tabela concede `DELETE` a `authenticated`; `anon` não tem grant em nenhuma tabela.

| Tabela                                              | S                                                                                          | I / U direto                                                      | Mutação via RPC                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| empresas                                            | membros                                                                                    | U: `empresa.configurar` (colunas de configuração)                 | —                                                                                         |
| perfis_usuario                                      | membros da mesma empresa (nome)                                                            | U: próprio usuário (nome, telefone)                               | —                                                                                         |
| usuarios_empresa                                    | todos os membros ativos da empresa (papel e status visíveis; e-mail não está nesta tabela) | —                                                                 | funções administrativas (Fase 3)                                                          |
| privado.papel_permissoes, privado.transicoes        | — (esquema não exposto)                                                                    | — (só migration)                                                  | —                                                                                         |
| fornecedores, centros_custo, categorias_bem, locais | membros                                                                                    | I/U: permissão `*.gerenciar`                                      | —                                                                                         |
| modelos_checklist, perguntas_checklist              | membros                                                                                    | I/U: `checklist.gerenciar` enquanto RASCUNHO                      | `rpc_publicar_checklist`, `rpc_nova_versao_checklist`                                     |
| locacoes                                            | leitura geral / RL escopo                                                                  | I/U: `locacao.criar/editar` em RASCUNHO (colunas descritivas)     | ativar, cancelar, aditivo, desmobilizar, encerrar_operacional, encerrar_financeiro        |
| referencias_externas                                | idem locações                                                                              | I/U: `locacao.referencia.gerenciar`                               | —                                                                                         |
| itens_locacao                                       | idem                                                                                       | I/U: `locacao.editar` em RASCUNHO                                 | `rpc_aditivo_item`                                                                        |
| recebimentos, itens_recebimento                     | leitura geral                                                                              | I/U: rascunho do autor com `recebimento.registrar`                | confirmar, enviar_autorizacao, autorizar_excesso, cancelar                                |
| bens, lotes                                         | leitura geral / RL escopo                                                                  | U: colunas de identificação **somente em AGUARDANDO_RECEBIMENTO** | todas as mudanças de status/local/responsável/quantidade                                  |
| vistorias, respostas_vistoria                       | leitura geral / RL escopo                                                                  | I/U: `vistoria.registrar` enquanto RASCUNHO                       | `rpc_concluir_vistoria`                                                                   |
| movimentacoes                                       | leitura geral / RL escopo                                                                  | —                                                                 | registrar, aceitar, recusar, cancelar                                                     |
| ocorrencias                                         | leitura geral / RL escopo                                                                  | —                                                                 | registrar, tratar, resolver, reabrir, cancelar, troca                                     |
| devolucoes, itens_devolucao                         | leitura geral                                                                              | I/U: rascunho com `devolucao.gerenciar`                           | solicitar, agendar, confirmar_retirada, conferir, cancelar, ciencia_financeira            |
| cobrancas                                           | leitura geral (sem RL)                                                                     | —                                                                 | registrar, conferir, marcar_divergente, resolver                                          |
| evidencias                                          | conforme entidade                                                                          | —                                                                 | `rpc_registrar_evidencia`, `rpc_substituir_evidencia`, `rpc_remover_evidencia`            |
| relatorios                                          | membros com `relatorio.gerar` (próprios) + ADMIN/GESTOR/AUDITOR todos                      | —                                                                 | `rpc_solicitar_relatorio`; worker usa service role apenas para atualizar status e storage |
| auditoria                                           | `auditoria.ler`                                                                            | — (só triggers/funções)                                           | —                                                                                         |
| auditoria_autenticacao, limites_taxa, sequencias    | — (sem grant)                                                                              | —                                                                 | funções internas                                                                          |

## 5. Storage

| Bucket                              | Leitura (`select` em `storage.objects`)                                                                                                     | Escrita                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| evidencias, contratos, comprovantes | `usuario_pertence_empresa(primeiro segmento do path)` **e** existe linha em `evidencias` com aquele `storage_path` visível ao usuário (RLS) | somente servidor (service role) após validação |
| relatorios                          | membro com `relatorio.gerar` e linha visível em `relatorios`                                                                                | somente worker                                 |

Buckets `public = false`. URLs assinadas: 5 minutos, geradas sob demanda, nunca persistidas.

## 6. Casos de teste obrigatórios (RLS)

Para cada tabela crítica (locacoes, itens_locacao, referencias_externas, recebimentos, bens, lotes, movimentacoes, ocorrencias, devolucoes, cobrancas, evidencias, auditoria, usuarios_empresa) e para storage:

| Ator                               | SELECT        | INSERT                                         | UPDATE                                                 | Cancelamento (RPC) |
| ---------------------------------- | ------------- | ---------------------------------------------- | ------------------------------------------------------ | ------------------ |
| anônimo                            | negado        | negado                                         | negado                                                 | negado             |
| papel autorizado da Empresa A em A | permitido     | conforme matriz                                | conforme matriz                                        | conforme matriz    |
| papel da Empresa A em dados de B   | 0 linhas      | negado                                         | 0 linhas afetadas                                      | negado             |
| usuário inativo de A               | 0 linhas      | negado                                         | negado                                                 | negado             |
| AUDITOR de A                       | permitido     | negado                                         | negado                                                 | negado             |
| RESPONSAVEL_LOCAL de A             | só seu escopo | negado (exceto ocorrência/evidência no escopo) | negado                                                 | negado             |
| qualquer authenticated             | —             | —                                              | `status`/`empresa_id`/`local_atual_id` diretos: negado | —                  |

## 7. Implementação no banco (Fase 2)

- Funções: `privado.usuario_pertence_empresa`, `privado.usuario_tem_permissao`, `privado.pode_ler` (= `dados.ler_geral`), `privado.ve_bem`, `privado.ve_lote`, `privado.ve_locacao_por_item`, `privado.ve_entidade` (escopo RESPONSAVEL_LOCAL). Todas `security definer` com `search_path` fixo (testado).
- Grants por coluna: ver `supabase/migrations/20261008120800_rls_privilegios.sql`. Colunas de estado, local/responsável atuais, quantidades derivadas, `empresa_id` (UPDATE), `codigo` e autoria nunca são graváveis por `authenticated` (testado em `tests/rls/estrutura.test.ts`).
- Evidências: RESPONSAVEL_LOCAL vê evidências de BEM/LOTE sob sua responsabilidade, das vistorias desses itens, das movimentações em que é origem/destino e das ocorrências que registrou ou que tratam de seus itens.
- Provas automatizadas: `tests/rls/isolamento-empresas.test.ts` (gate A×B), `tests/rls/atores.test.ts` (anônimo, inativo, sem empresa, AUDITOR, RESPONSAVEL_LOCAL, matriz de escrita, operações de estado), `tests/rls/storage.test.ts`.
