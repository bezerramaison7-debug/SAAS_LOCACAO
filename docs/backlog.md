# Backlog do MVP, plano por fases e riscos

> Critérios de aceite detalhados (CA-xx) em `docs/business-rules.md §7`. Cada fase termina num **gate** verificável; nenhuma fase começa sem autorização explícita.

## 1. Plano de execução por fases

| Fase | Objetivo | Gate de saída |
|------|----------|---------------|
| 0 | Descoberta e contrato técnico (este conjunto de documentos) | Documentos aprovados pelo responsável |
| 1 | Fundação: Next.js, TS strict, lint, Prettier, Vitest, Playwright, Tailwind, design system, layout responsivo, tema, clientes Supabase, validação de env, CI | lint, typecheck, unit e build PASS |
| 2 | Banco e segurança: migrations, enums, constraints, índices, triggers, RLS, funções de segurança, storage privado, seed, testes de isolamento | Empresa A não consulta nem altera Empresa B (testes RLS PASS) |
| 3 | Autenticação e usuários: login, logout, recuperação, SSR, contexto de empresa, papéis, admin de usuários, permissões no servidor | Cada perfil executa só o permitido (unit + RLS + E2E de perfil) |
| 4 | Cadastros e locações: fornecedor, local, centro de custo, categoria, checklist (versões), locação em etapas, Sectra, itens, lista com filtros, detalhe | Compras cria e ativa locação completa com persistência real |
| 5 | Recebimento e evidências: fluxo mobile, bens, lotes, vistoria de entrada, fotos, divergências | Recebimento completo no celular; evidências privadas |
| 6 | Movimentações e ocorrências: transferência, aceite, timeline, ocorrência, troca, manutenção, extravio, QR Code | Local/responsável = último evento confirmado, histórico intacto |
| 7 | Devolução e financeiro: etapas, parcial/total, vistoria de saída, comprovante, cobranças, estimativa, ciência, encerramentos | Encerramentos operacional e financeiro independentes |
| 8 | Dashboard e PDF: indicadores clicáveis, alertas, relatórios assíncronos com fotos e hash | Relatório completo sem manipular fotos manualmente |
| 9 | Qualidade e homologação: suíte completa, 375/768/desktop, acessibilidade, teclado, segurança, dependências, backup/restore, manual | Nenhuma falha crítica/alta aberta |

## 2. Backlog (épicos → histórias)

Prioridade: **P0** = indispensável ao critério final de pronto; **P1** = importante no MVP; **P2** = desejável se houver folga.

### E0 — Fundação (Fase 1)
- F1.1 P0 Inicializar Next.js 16 + TS strict + ESLint + Prettier + scripts (`lint`, `typecheck`, `test`, `test:integration`, `test:rls`, `build`, `e2e`).
- F1.2 P0 Tailwind 4 + tokens (neutros + 1 cor primária + semânticas de estado), tema claro/escuro, foco visível, tipografia ≥ 16 px.
- F1.3 P0 Componentes base (Button, Input, Select, Dialog de confirmação, Table→Card responsivo, Skeleton, EmptyState, Badge de status, FormField com erro contextual, Pagination).
- F1.4 P0 App shell: sidebar recolhível (desktop), navegação inferior compacta (mobile), cabeçalho com empresa ativa.
- F1.5 P0 `lib/env` com validação Zod e falha cedo; `.env.example`.
- F1.6 P0 Clientes Supabase (browser, server, admin `server-only`) e `proxy.ts` com request_id + headers de segurança.
- F1.7 P0 Formatadores de data (fuso empresa) e moeda pt-BR + testes.
- F1.8 P0 Vitest e Playwright configurados com um teste real cada; CI (lint, typecheck, unit, build, varredura de segredos no bundle).
- F1.9 P1 Logger estruturado com redaction + `/api/health`.

### E1 — Banco e segurança (Fase 2)
- F2.1 P0 Enums e tabelas (todas do diagrama) com FKs compostas, checks, uniques, índices.
- F2.2 P0 Triggers: `updated_at`, `created_by/updated_by`, auditoria genérica, guarda de transição, imutabilidade (movimentações, vistorias concluídas, checklist publicado, auditoria), último ADMIN.
- F2.3 P0 Funções de segurança e `papel_permissoes`; RLS + grants mínimos + grants por coluna em todas as tabelas.
- F2.4 P0 `proximo_codigo`, visões de saldo.
- F2.5 P0 Buckets privados + policies de `storage.objects`.
- F2.6 P0 Seed idempotente (Empresa A e B, todos os perfis, 2 fornecedores, 3 locais, 2 centros de custo, rascunho, ativa com recebimento parcial, em devolução, bens, lote, vistorias, movimentações, ocorrência) marcado `[DEMONSTRAÇÃO]`.
- F2.7 P0 Harness de testes RLS (JWT por perfil) + suíte de isolamento A×B, inativo, anônimo, somente leitura.
- F2.8 P0 Geração de tipos (`supabase gen types`).

### E2 — Autenticação e usuários (Fase 3)
- F3.1 P0 Login (erro específico, sem enumeração de contas), logout, recuperação e redefinição de senha.
- F3.2 P0 `getContexto()`/`exigirPermissao()`; seleção de empresa; tela "sem acesso".
- F3.3 P0 Matriz de permissões TS + teste de paridade com o banco + `can()` na UI.
- F3.4 P0 Admin de usuários: convidar, alterar papel, ativar/desativar (auditado), proteção do último ADMIN.
- F3.5 P1 Auditoria de autenticação.
- F3.6 P1 Configurações da empresa (fuso, aceite de movimentação, limite de atraso, limites de upload).

### E3 — Cadastros e locações (Fase 4)
- F4.1 P0 CRUD (sem delete físico) de fornecedores, locais, centros de custo, categorias.
- F4.2 P0 Modelos de checklist versionados (rascunho → publicar → nova versão) + perguntas.
- F4.3 P0 Nova locação em etapas (identificação → referências Sectra → itens → vigência/cobrança → revisão) com rascunho no servidor.
- F4.4 P0 Ativação/cancelamento com validações (RN-13/14).
- F4.5 P0 Lista com busca/filtros/paginação server-side, filtros na URL.
- F4.6 P0 Detalhe com abas: resumo, itens, recebimentos, bens/lotes, movimentações, evidências, devoluções, cobranças, histórico; ação primária contextual.
- F4.7 P1 Aditivo de itens em locação ativa.
- F4.8 P1 Anexo de contrato/pedido (bucket `contratos`).

### E4 — Recebimento e evidências (Fase 5)
- F5.1 P0 Upload/download seguro de evidências (`/api/files`), substituição e remoção lógica.
- F5.2 P0 Fluxo mobile de recebimento em 10 etapas com rascunho persistido.
- F5.3 P0 Cadastro de bens (identificação física conforme categoria) e lotes.
- F5.4 P0 Vistoria de entrada com checklist versionado e regra de foto obrigatória.
- F5.5 P0 Confirmação transacional; excesso com autorização + ocorrência automática.
- F5.6 P1 Cancelamento de recebimento confirmado (ADMIN).
- F5.7 P1 Geolocalização opcional nas fotos.

### E5 — Movimentações e ocorrências (Fase 6)
- F6.1 P0 Movimentação de bem/lote (total e parcial com divisão), com/sem aceite.
- F6.2 P0 Aceite/recusa pelo novo responsável; "meus itens" para RESPONSAVEL_LOCAL.
- F6.3 P0 Ficha do bem/lote com timeline imutável e alertas.
- F6.4 P0 Ocorrências: registrar, tratar, resolver, reabrir, cancelar; prazos e vencidas.
- F6.5 P0 Troca de equipamento (novo bem + vistoria; antigo SUBSTITUIDO).
- F6.6 P1 Manutenção e extravio com retorno ao estado anterior/baixa.
- F6.7 P1 QR Code na ficha + rota `/q/{id}` + etiqueta imprimível.
- F6.8 P2 Vistoria periódica.

### E6 — Devolução e financeiro (Fase 7)
- F7.1 P0 Devolução: seleção de bens/quantidades disponíveis, solicitação, agendamento/reagendamento, retirada (quantidade retirada, recebedor, vistoria de saída), conferência, cancelamento.
- F7.2 P0 Saldo atualizado só na retirada; `ENCERRAMENTO_PENDENTE` quando zera.
- F7.3 P0 Comprovante de retirada (bucket `comprovantes`).
- F7.4 P0 Encerramento operacional com checagem de elegibilidade.
- F7.5 P0 Cobranças: registrar, conferir, divergente, resolver; documento anexo.
- F7.6 P0 Encerramento financeiro com data (FINANCEIRO/ADMIN).
- F7.7 P1 Ciência financeira por devolução.
- F7.8 P1 Estimativa de cobrança com aviso legal.

### E7 — Dashboard e relatórios (Fase 8)
- F8.1 P0 Indicadores com regra exibida e link filtrado (tabela §5.2 de business-rules).
- F8.2 P0 Relatório de locação completo (todas as seções) com fotos e legendas.
- F8.3 P0 Fila assíncrona, worker, watchdog, polling na UI, download assinado.
- F8.4 P0 Hash de dados, hash de arquivo, HMAC, versão do template, gerador.
- F8.5 P1 Relatórios por bem, local e período.
- F8.6 P1 Alertas de términos e ocorrências vencidas.

### E8 — Qualidade e homologação (Fase 9)
- F9.1 P0 Suíte E2E completa (16 cenários) em 3 navegadores e 3 viewports.
- F9.2 P0 Auditoria de acessibilidade (axe) e navegação por teclado.
- F9.3 P0 Revisão de segurança (funções `security definer`, headers, CSP, dependências).
- F9.4 P0 Procedimento de backup/restore testado e documentado.
- F9.5 P0 README, guia de deploy, manual rápido do usuário.
- F9.6 P1 Política de retenção de evidências.

## 3. Mapeamento dos testes E2E obrigatórios → fase em que nascem
| # | Cenário | Fase |
|---|---------|------|
| 1–2 | Login / logout | 3 |
| 15 | Restrição por perfil | 3 (ampliado em cada fase) |
| 16 | Acesso cruzado entre empresas | 3 (ampliado em cada fase) |
| 3–6 | Criar locação, vincular Sectra, item individual, item em lote | 4 |
| 7–8 | Receber equipamento, adicionar evidência | 5 |
| 9–10 | Transferir equipamento, registrar ocorrência | 6 |
| 11–13 | Devolver parte de lote, devolver bem individual, encerramento financeiro | 7 |
| 14 | Gerar relatório | 8 |

## 4. Riscos

| # | Risco | Prob. | Impacto | Mitigação |
|---|-------|-------|---------|-----------|
| R-01 | Policy RLS incorreta vaza dados entre empresas | M | **Crítico** | FKs compostas (D-05); suíte RLS por tabela×operação×ator no CI; revisão de cada `security definer`; nenhuma tabela sem RLS (teste que lista `pg_tables` sem `rowsecurity`). |
| R-02 | Função `security definer` sem checagem de permissão vira escalonamento | M | **Crítico** | Template obrigatório (deriva empresa da linha, `usuario_tem_permissao`, `search_path=''`); teste automático que chama toda `rpc_*` como AUDITOR e espera negação. |
| R-03 | Service role exposta ao navegador | B | **Crítico** | `server-only`, env separado por arquivo, varredura do bundle no CI, uso restrito a `lib/storage/admin` e admin de usuários. |
| R-04 | Upload malicioso (polyglot, HTML/SVG, PDF com JS) | M | Alto | Magic bytes + decodificação `sharp` + whitelist sem SVG + `Content-Disposition`/`nosniff` + URLs assinadas curtas. |
| R-05 | Fotos grandes em rede móvel ruim falham no recebimento | A | Alto | Upload por foto (não em lote), retentativa, rascunho no servidor; confirmação só quando todas as fotos obrigatórias estiverem registradas. Offline completo está fora do escopo. |
| R-06 | PDF com muitas fotos estoura tempo/memória serverless | M | Alto | Job assíncrono, miniaturas com `sharp`, limite de fotos por relatório, watchdog e retentativas; possibilidade de rodar o worker fora da Vercel. |
| R-07 | Regras de estado divergentes entre TS e SQL | M | Médio | Banco é autoridade; teste de paridade das tabelas de transição. |
| R-08 | Concorrência (duas devoluções/movimentações simultâneas do mesmo item) | M | Alto | `for update` nas funções, índice único parcial em `itens_devolucao`, checks de quantidade. |
| R-09 | Suposições de negócio (S-01…S-10) erradas geram retrabalho | M | Médio | Validar antes da Fase 4; modelo já preparado para as alternativas listadas. |
| R-10 | Ausência de Docker no ambiente de desenvolvimento atual | A | Médio | D-19 (Postgres local + bootstrap); fidelidade total no CI. |
| R-11 | Fuso horário em "términos em N dias" e atrasos | M | Médio | Cálculos com fuso da empresa no SQL (`at time zone`) e testes de borda (virada de dia, horário de verão histórico). |
| R-12 | Precisão monetária perdida em JS | B | Médio | `numeric` no banco, strings decimais no transporte, `decimal.js`; lint/teste contra `parseFloat` em módulos de dinheiro. |
| R-13 | Volume de auditoria cresce rápido | M | Baixo | Índices por `(empresa_id, entidade_tipo, entidade_id, created_at)`; particionamento futuro. |
| R-14 | Usuários registram eventos atrasados e invertem a ordem cronológica | A | Médio | `data_evento` × `created_at` separados, selo "lançado com atraso", estado atual derivado da ordem de **confirmação**, não de `data_evento`. |
| R-15 | Dependência de SMTP para convite/recuperação | M | Médio | Documentar SMTP customizado no Supabase para homologação/produção. |
