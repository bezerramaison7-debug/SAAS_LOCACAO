# Política de retenção de evidências e registros

> Fase 9 — F9.6 (P1). Os **prazos** abaixo são o padrão técnico proposto e precisam ser **validados pelo jurídico** de cada empresa cliente antes da produção. O **comportamento** descrito (nada é apagado pela aplicação) já está implementado e testado.

## 1. Princípio

O sistema existe para provar o que aconteceu com cada equipamento. Por isso a aplicação **não apaga fisicamente** nenhum registro nem arquivo de evidência:

| O que                                                     | Como "sai de cena"                                                    | O que fica guardado                                                    |
| --------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Evidência (foto, documento)                               | **Remoção lógica** com motivo obrigatório, ou substituição com motivo | Arquivo original no Storage, hash, quem removeu, quando e por quê      |
| Locação, recebimento, devolução, ocorrência, movimentação | Cancelamento com motivo (nunca exclusão)                              | O registro inteiro, com o estado cancelado                             |
| Cadastros (fornecedor, local, categoria…)                 | Inativação                                                            | O cadastro, para manter o histórico legível                            |
| Usuário                                                   | Desativação da associação com a empresa                               | Nome nos eventos e na auditoria (necessário para a cadeia de custódia) |
| Relatório PDF                                             | Não se altera; gerar de novo cria outro código (RN-112)               | Arquivo, hashes e HMAC                                                 |
| Auditoria                                                 | Nunca (append-only, sem permissão de alteração ou exclusão)           | Tudo                                                                   |

Garantias técnicas: `DELETE` só existe para linhas de **rascunho** (itens e referências de locação em rascunho, linhas de recebimento em rascunho, perguntas de checklist não publicado e respostas de vistoria em andamento — policies por estado e triggers de imutabilidade, e mesmo essas exclusões ficam na auditoria); nenhuma outra tabela de negócio concede `DELETE`; chaves estrangeiras `ON DELETE RESTRICT`, auditoria sem grants de alteração, policies de Storage sem remoção para usuários (`tests/rls/estrutura.test.ts`, `tests/rls/storage.test.ts`). A única remoção física feita pelo servidor é a **compensação** de um upload cujo registro no banco falhou (o arquivo nunca chegou a ser uma evidência — D-49) ou de um PDF cuja conclusão falhou.

## 2. Prazos propostos

| Dado                                        | Prazo mínimo de guarda                                                                        | Base                                                                                               |
| ------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Evidências, documentos, relatórios, eventos | Enquanto a empresa for cliente **e** até **5 anos** após o encerramento financeiro da locação | Prazo de cobrança de dívidas líquidas em contrato (Código Civil, art. 206, §5º, I) — **a validar** |
| Auditoria                                   | Igual ao do registro auditado mais longo da empresa                                           | Cadeia de custódia                                                                                 |
| Logs de aplicação (Vercel/Sentry)           | Conforme o plano (dias); não contêm senha, token nem conteúdo de arquivo                      | Operação                                                                                           |
| Backups do banco (Supabase)                 | Janela do plano (diários + PITR)                                                              | `docs/backup.md`                                                                                   |
| Backups do Storage (`scripts/backup`)       | 90 dias de cópias diárias + 1 cópia mensal por 12 meses (sugestão)                            | `docs/backup.md`                                                                                   |

## 3. Fim do prazo e encerramento de contrato

- Ao fim do prazo, ou quando a empresa cliente encerrar o contrato, o descarte é uma **operação administrativa** executada pela equipe de operação (não pela aplicação), com registro de quem autorizou, por empresa e por período, removendo banco e objetos do Storage do `empresa_id` correspondente.
- Antes do descarte, a empresa cliente pode pedir a exportação dos relatórios PDF (por locação ou período) — eles já contêm os dados, as fotos e os hashes.
- **Pendência registrada:** o procedimento de descarte por empresa (script com dupla confirmação) não foi implementado no MVP, porque nenhum dado atingirá o prazo antes de 5 anos de uso. Deve existir antes do primeiro encerramento de contrato de cliente.

## 4. Dados pessoais (LGPD)

- Dados pessoais tratados: nome, e-mail e telefone dos usuários; nomes de quem entregou/recebeu equipamentos; pessoas que eventualmente apareçam em fotos de vistoria.
- Finalidade: rastreabilidade e prova de estado de equipamentos locados (execução de contrato e exercício regular de direitos).
- Pedido de exclusão de um usuário: a conta é desativada e o e-mail pode ser anonimizado em `auth.users`; o **nome** permanece nos eventos e na auditoria enquanto durar o prazo do §2, pois é parte da prova.
- Fotos devem enquadrar o equipamento; orientação no manual do usuário.
