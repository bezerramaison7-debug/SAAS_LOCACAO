# Manual rápido do usuário

> Rastreio de Locações — o que acontece com o equipamento **depois** do pedido de compra no Sectra.
> O Sectra continua sendo o sistema do pedido; aqui você **digita** o número do pedido/documento (não há integração automática).

## 1. Entrar e navegar

- Acesse o endereço da sua empresa e entre com **e-mail e senha**. Não tem conta? Peça ao **administrador** da empresa um convite (chega por e-mail; você cria a senha pelo link).
- Esqueceu a senha: **Esqueci minha senha** na tela de login.
- Trabalha para mais de uma empresa: escolha a empresa ao entrar; troque depois pelo botão **Trocar empresa** no menu do usuário.
- Menu: **Painel, Locações, Recebimentos, Bens e lotes, Movimentações, Vistorias, Ocorrências, Devoluções, Cobranças, Relatórios, Cadastros, Configurações**. Você só vê o que o seu papel permite.
- No celular, o menu fica na barra inferior e no botão de menu; tudo funciona com a câmera do aparelho para fotos.
- Datas e horas aparecem no fuso da sua empresa. Ao registrar algo que aconteceu antes, informe a **data do fato**: depois do prazo configurado pela empresa, o registro recebe o selo **"Lançado com atraso"**.

## 2. O que cada papel faz

| Papel                 | No dia a dia                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| **Administrador**     | Tudo da empresa, incluindo usuários (Configurações → Usuários) e configurações                            |
| **Compras**           | Fornecedores, locações, número do pedido Sectra, contratos; autoriza recebimento acima do contratado      |
| **Operação**          | Recebimentos, vistorias, movimentações, ocorrências, trocas, devoluções, encerramento operacional         |
| **Responsável local** | Consulta os itens sob sua responsabilidade, aceita/recusa transferências, registra ocorrências sobre eles |
| **Financeiro**        | Cobranças, ciência das devoluções, encerramento financeiro                                                |
| **Gestor**            | Painel, consultas e relatórios                                                                            |
| **Auditor**           | Leitura geral, histórico e relatórios — não altera nada                                                   |

## 3. Fluxo completo de uma locação

### 3.1 Compras — criar a locação

1. **Locações → Nova locação**: fornecedor (ou **Cadastrar fornecedor**), centro de custo, datas previstas, periodicidade da cobrança → **Criar rascunho e continuar**.
2. **Vincule o pedido do Sectra**: informe o número do documento → **Vincular documento**.
3. **Adicionar item**: categoria, descrição, unidade, quantidade contratada e valor unitário. Categorias "por lote" (andaimes, escoras) aceitam quantidade; as de controle individual exigem número inteiro.
4. **Salvar e revisar**. Se faltar algo, a tela mostra **"Ainda falta completar"**. Quando estiver completa → **Ativar locação**.
5. Contrato assinado: aba **Documentos** → anexar o PDF.

### 3.2 Operação — receber o equipamento

1. Na locação ativa: **Registrar recebimento** (ou **Recebimentos → Novo recebimento**) → **Iniciar recebimento**.
2. Para cada item: **Incluir unidade** (bem individual: número de série/placa/patrimônio e condição) ou **Registrar quantidade** (lote).
3. **Fotos**: use **Tirar foto**. Item "Avariado" exige foto.
4. **Fazer vistoria**: responda o checklist (algumas perguntas pedem foto) → **Salvar respostas** → **Concluir vistoria**. Vistoria concluída não se altera.
5. Informe **local** e **responsável** → **Salvar e revisar** → confirme. Recebeu mais que o contratado? O recebimento fica **Aguardando autorização** de Compras.

### 3.3 No dia a dia

- **Movimentar** (ficha do bem/lote ou Movimentações): local de destino, novo responsável e motivo → **Registrar movimentação**. Se a empresa exige aceite, o item fica em transferência até o destinatário **Aceitar** ou **Recusar** (Movimentações → "Aguardando o seu aceite").
- **Ocorrência** (defeito, avaria, manutenção, extravio…): **Registrar ocorrência** na ficha do item; depois **Resolver ocorrência** informando como foi resolvida. Itens em manutenção não podem ser movimentados.
- **Troca pelo fornecedor**: **Registrar troca** na ficha; o novo bem entra com vistoria de entrada pendente.
- **Vistoria periódica**: **Vistoria periódica** na ficha do item.
- **QR Code**: **Imprimir etiqueta** na ficha. Ler o QR abre a ficha — só para quem tem acesso.
- **Linha do tempo** da ficha mostra tudo o que aconteceu, em ordem, e nunca é apagada. Correções são feitas como novo evento, com motivo.

### 3.4 Operação — devolver

1. Na locação: **Solicitar devolução** escolhendo bens e quantidades de lote (os itens ficam reservados).
2. **Agendar retirada** → **Fazer vistoria de saída** (condição e fotos) → **Confirmar retirada** informando quem recebeu pelo fornecedor. O saldo só muda aqui.
3. **Anexar comprovante** e **Conferir devolução**.
4. Quando todo o saldo foi devolvido: **Encerrar operação** (encerramento operacional).

### 3.5 Financeiro — cobrar e encerrar

1. **Cobranças → Registrar cobrança**: competência, número do documento, valor cobrado e anexo → **Conferir cobrança** (ou marcar divergência e depois resolver).
2. Nas devoluções: **Registrar ciência financeira**.
3. Sem cobranças pendentes/divergentes: **Confirmar encerramento financeiro**. Ele é independente do operacional.

## 4. Painel e relatórios

- **Painel**: cada número mostra a **regra de cálculo** e, ao clicar, abre a lista filtrada com o mesmo total.
- **Relatório PDF**: **Gerar relatório PDF** na locação ou na ficha do bem, ou em **Relatórios** (por local ou período). A página acompanha até ficar **Pronto**; então **Baixar PDF**. O PDF traz fotos com legenda e um **hash** que prova que os dados não foram alterados; o mesmo hash aparece na página do relatório.

## 5. Boas práticas de evidência

- Fotografe o **equipamento** (número de série/placa visível), não pessoas.
- Uma foto por envio; em rede ruim, aguarde "Arquivo enviado." antes de seguir.
- Foto errada: na galeria, **Substituir** ou **Remover** (com motivo; Operação/Admin). O original continua guardado para auditoria (`docs/retencao.md`).
- Formatos aceitos: JPG, PNG, WEBP e PDF.

## 6. Acessibilidade

- Todas as telas funcionam só com teclado: **Tab** avança, **Enter** confirma, **Esc** fecha diálogos. O primeiro **Tab** oferece "Pular para o conteúdo".
- Tema claro, escuro ou do sistema no topo da página.

## 7. Problemas

- Mensagens de erro trazem um **código de suporte**: envie-o ao administrador.
- "Página não encontrada" numa tela que existe significa que o seu papel não tem acesso a ela.
