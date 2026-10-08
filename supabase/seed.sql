-- =============================================================================
-- SEED DE DEMONSTRAÇÃO — somente DEV/CI (D-18).
--
-- * Executado por `supabase db reset` (local/CI) ou scripts/db/reset-local.sh.
-- * `supabase db push` (deploy) NÃO executa seed.
-- * Bloqueado se o banco estiver marcado como produção:
--     alter database postgres set app.ambiente = 'producao';
-- * Idempotente: se a Empresa A de demonstração já existe, não faz nada.
-- * Todos os dados são marcados como [DEMONSTRAÇÃO] e empresas.demonstracao = true.
--
-- Usuários (senha de todos: Demo@123456) — e-mails @demo.rastreio.test:
--   Empresa A: admin.a, compras.a, operacao.a, responsavel.a, financeiro.a,
--              gestor.a, auditor.a, inativo.a (associação inativa)
--   Empresa B: admin.b, operacao.b
--   Sem empresa: sem.empresa
-- IDs fixos espelhados em tests/support/fixtures.ts.
-- =============================================================================

do $seed$
declare
  -- empresas
  emp_a constant uuid := 'a0000000-0000-4000-8000-000000000001';
  emp_b constant uuid := 'b0000000-0000-4000-8000-000000000001';
  -- usuários
  u_admin_a constant uuid := 'a1000000-0000-4000-8000-000000000001';
  u_compras_a constant uuid := 'a1000000-0000-4000-8000-000000000002';
  u_operacao_a constant uuid := 'a1000000-0000-4000-8000-000000000003';
  u_resp_a constant uuid := 'a1000000-0000-4000-8000-000000000004';
  u_fin_a constant uuid := 'a1000000-0000-4000-8000-000000000005';
  u_gestor_a constant uuid := 'a1000000-0000-4000-8000-000000000006';
  u_auditor_a constant uuid := 'a1000000-0000-4000-8000-000000000007';
  u_inativo_a constant uuid := 'a1000000-0000-4000-8000-000000000008';
  u_admin_b constant uuid := 'b1000000-0000-4000-8000-000000000001';
  u_operacao_b constant uuid := 'b1000000-0000-4000-8000-000000000002';
  u_sem_empresa constant uuid := 'c1000000-0000-4000-8000-000000000001';
  -- cadastros A
  forn_a1 constant uuid := 'a2000000-0000-4000-8000-000000000001';
  forn_a2 constant uuid := 'a2000000-0000-4000-8000-000000000002';
  local_alm_a constant uuid := 'a3000000-0000-4000-8000-000000000001';
  local_obra1_a constant uuid := 'a3000000-0000-4000-8000-000000000002';
  local_obra2_a constant uuid := 'a3000000-0000-4000-8000-000000000003';
  cc_a1 constant uuid := 'a4000000-0000-4000-8000-000000000001';
  cc_a2 constant uuid := 'a4000000-0000-4000-8000-000000000002';
  modelo_a constant uuid := 'a5000000-0000-4000-8000-000000000001';
  familia_a constant uuid := 'a5100000-0000-4000-8000-000000000001';
  perg_a1 constant uuid := 'a5200000-0000-4000-8000-000000000001';
  perg_a2 constant uuid := 'a5200000-0000-4000-8000-000000000002';
  perg_a3 constant uuid := 'a5200000-0000-4000-8000-000000000003';
  cat_estacao_a constant uuid := 'a6000000-0000-4000-8000-000000000001';
  cat_notebook_a constant uuid := 'a6000000-0000-4000-8000-000000000002';
  cat_andaime_a constant uuid := 'a6000000-0000-4000-8000-000000000003';
  -- locações A
  loc_rascunho_a constant uuid := 'a7000000-0000-4000-8000-000000000001';
  loc_ativa_a constant uuid := 'a7000000-0000-4000-8000-000000000002';
  loc_devolucao_a constant uuid := 'a7000000-0000-4000-8000-000000000003';
  item_rasc_a constant uuid := 'a8000000-0000-4000-8000-000000000001';
  item_estacao_a constant uuid := 'a8000000-0000-4000-8000-000000000002';
  item_andaime_a constant uuid := 'a8000000-0000-4000-8000-000000000003';
  item_notebook_a constant uuid := 'a8000000-0000-4000-8000-000000000004';
  rec_ativa_a constant uuid := 'a9000000-0000-4000-8000-000000000001';
  rec_devolucao_a constant uuid := 'a9000000-0000-4000-8000-000000000002';
  bem_estacao1_a constant uuid := 'aa000000-0000-4000-8000-000000000001';
  bem_estacao2_a constant uuid := 'aa000000-0000-4000-8000-000000000002';
  bem_notebook_a constant uuid := 'aa000000-0000-4000-8000-000000000003';
  lote_andaime_a constant uuid := 'ab000000-0000-4000-8000-000000000001';
  vist_bem1_a constant uuid := 'ac000000-0000-4000-8000-000000000001';
  vist_lote_a constant uuid := 'ac000000-0000-4000-8000-000000000002';
  mov_bem1_a constant uuid := 'ad000000-0000-4000-8000-000000000001';
  ocor_bem2_a constant uuid := 'ae000000-0000-4000-8000-000000000001';
  dev_a constant uuid := 'af000000-0000-4000-8000-000000000001';
  cob_a constant uuid := 'af100000-0000-4000-8000-000000000001';
  -- B
  forn_b1 constant uuid := 'b2000000-0000-4000-8000-000000000001';
  forn_b2 constant uuid := 'b2000000-0000-4000-8000-000000000002';
  local_b1 constant uuid := 'b3000000-0000-4000-8000-000000000001';
  local_b2 constant uuid := 'b3000000-0000-4000-8000-000000000002';
  local_b3 constant uuid := 'b3000000-0000-4000-8000-000000000003';
  cc_b1 constant uuid := 'b4000000-0000-4000-8000-000000000001';
  cc_b2 constant uuid := 'b4000000-0000-4000-8000-000000000002';
  cat_gerador_b constant uuid := 'b6000000-0000-4000-8000-000000000001';
  loc_ativa_b constant uuid := 'b7000000-0000-4000-8000-000000000001';
  item_gerador_b constant uuid := 'b8000000-0000-4000-8000-000000000001';
  rec_b constant uuid := 'b9000000-0000-4000-8000-000000000001';
  bem_gerador_b constant uuid := 'ba000000-0000-4000-8000-000000000001';

  senha_hash text;
  u record;
begin
  if coalesce(current_setting('app.ambiente', true), '') in ('producao', 'production') then
    raise exception 'Seed de demonstração bloqueado: banco marcado como produção (app.ambiente).';
  end if;

  if exists (select 1 from public.empresas where id = emp_a) then
    raise notice 'Seed de demonstração já aplicado; nada a fazer.';
    return;
  end if;

  -- ------------------------------------------------------------ usuários ----
  senha_hash := extensions.crypt('Demo@123456', extensions.gen_salt('bf'));
  for u in select * from (values
    (u_admin_a, 'admin.a', '[DEMO] Ana Admin (A)'),
    (u_compras_a, 'compras.a', '[DEMO] Carlos Compras (A)'),
    (u_operacao_a, 'operacao.a', '[DEMO] Olívia Operação (A)'),
    (u_resp_a, 'responsavel.a', '[DEMO] Rafael Responsável (A)'),
    (u_fin_a, 'financeiro.a', '[DEMO] Fernanda Financeiro (A)'),
    (u_gestor_a, 'gestor.a', '[DEMO] Gustavo Gestor (A)'),
    (u_auditor_a, 'auditor.a', '[DEMO] Aurora Auditora (A)'),
    (u_inativo_a, 'inativo.a', '[DEMO] Ivo Inativo (A)'),
    (u_admin_b, 'admin.b', '[DEMO] Bruna Admin (B)'),
    (u_operacao_b, 'operacao.b', '[DEMO] Otávio Operação (B)'),
    (u_sem_empresa, 'sem.empresa', '[DEMO] Sem Empresa')
  ) as v (id, login, nome) loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
      u.login || '@demo.rastreio.test', senha_hash, now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('nome', u.nome),
      now(), now(), '', '', '', ''
    ) on conflict (id) do nothing;
    insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (u.id::text, u.id,
            jsonb_build_object('sub', u.id::text, 'email', u.login || '@demo.rastreio.test', 'email_verified', true),
            'email', now(), now(), now())
    on conflict (provider_id, provider) do nothing;
    insert into public.perfis_usuario (user_id, nome) values (u.id, u.nome);
  end loop;

  -- ------------------------------------------------------------ empresas ----
  insert into public.empresas (id, nome, documento, demonstracao, exige_aceite_movimentacao) values
    (emp_a, '[DEMONSTRAÇÃO] Empresa A Construções', '00.000.000/0001-91', true, false),
    (emp_b, '[DEMONSTRAÇÃO] Empresa B Engenharia', '11.111.111/0001-91', true, true);

  insert into public.usuarios_empresa (empresa_id, user_id, papel, ativo) values
    (emp_a, u_admin_a, 'ADMIN', true),
    (emp_a, u_compras_a, 'COMPRAS', true),
    (emp_a, u_operacao_a, 'OPERACAO', true),
    (emp_a, u_resp_a, 'RESPONSAVEL_LOCAL', true),
    (emp_a, u_fin_a, 'FINANCEIRO', true),
    (emp_a, u_gestor_a, 'GESTOR', true),
    (emp_a, u_auditor_a, 'AUDITOR', true),
    (emp_a, u_inativo_a, 'OPERACAO', false),
    (emp_b, u_admin_b, 'ADMIN', true),
    (emp_b, u_operacao_b, 'OPERACAO', true);

  -- ----------------------------------------------------------- cadastros ----
  insert into public.fornecedores (id, empresa_id, razao_social, nome_fantasia, documento, contato) values
    (forn_a1, emp_a, '[DEMONSTRAÇÃO] TopoLoc Equipamentos Ltda', 'TopoLoc', '22.222.222/0001-91',
     '{"nome":"Paula","email":"comercial@topoloc.demo","telefone":"(11) 4000-0001"}'),
    (forn_a2, emp_a, '[DEMONSTRAÇÃO] Andaimes Forte S.A.', 'Andaimes Forte', '33.333.333/0001-91',
     '{"nome":"Marcos","telefone":"(11) 4000-0002"}'),
    (forn_b1, emp_b, '[DEMONSTRAÇÃO] Geradores Brasil Ltda', 'GerBras', '44.444.444/0001-91', '{}'),
    (forn_b2, emp_b, '[DEMONSTRAÇÃO] TopoLoc Equipamentos Ltda', 'TopoLoc', '22.222.222/0001-91', '{}');

  insert into public.locais (id, empresa_id, codigo, nome, tipo, endereco) values
    (local_alm_a, emp_a, 'ALM-CENTRAL', '[DEMO] Almoxarifado Central', 'ALMOXARIFADO', 'Rua das Indústrias, 100'),
    (local_obra1_a, emp_a, 'OBRA-001', '[DEMO] Obra Residencial Norte', 'OBRA', 'Av. Norte, 500'),
    (local_obra2_a, emp_a, 'OBRA-002', '[DEMO] Obra Ponte Sul', 'OBRA', 'Rod. Sul, km 12'),
    (local_b1, emp_b, 'ALM-CENTRAL', '[DEMO] Almoxarifado B', 'ALMOXARIFADO', null),
    (local_b2, emp_b, 'OBRA-001', '[DEMO] Obra Industrial B', 'OBRA', null),
    (local_b3, emp_b, 'ESC-01', '[DEMO] Escritório B', 'ESCRITORIO', null);

  insert into public.centros_custo (id, empresa_id, codigo, nome) values
    (cc_a1, emp_a, 'CC-1001', '[DEMO] Obras Residenciais'),
    (cc_a2, emp_a, 'CC-2001', '[DEMO] Infraestrutura'),
    (cc_b1, emp_b, 'CC-1001', '[DEMO] Obras B'),
    (cc_b2, emp_b, 'CC-9000', '[DEMO] Administrativo B');

  -- Checklist: criado em rascunho, perguntas, depois publicado (versão imutável).
  insert into public.modelos_checklist (id, empresa_id, familia_id, versao, nome, descricao) values
    (modelo_a, emp_a, familia_a, 1, '[DEMO] Inspeção de equipamento', 'Checklist padrão de entrada e saída.');
  insert into public.perguntas_checklist
    (id, empresa_id, modelo_id, ordem, texto, tipo_resposta, opcoes, obrigatoria, exige_foto_se) values
    (perg_a1, emp_a, modelo_a, 1, 'Estado geral do equipamento', 'CONFORME_NAO_CONFORME', null, true,
     '{"modo":"SEMPRE"}'),
    (perg_a2, emp_a, modelo_a, 2, 'Plaqueta de identificação legível?', 'SIM_NAO', null, true,
     '{"modo":"RESPOSTAS","respostas":["NAO"]}'),
    (perg_a3, emp_a, modelo_a, 3, 'Acessórios presentes', 'OPCAO_UNICA', '["Completos","Incompletos","Não se aplica"]',
     false, '{"modo":"RESPOSTAS","respostas":["Incompletos"]}');
  update public.modelos_checklist set status = 'PUBLICADO', publicado_em = now(), publicado_por = u_operacao_a
  where id = modelo_a;

  insert into public.categorias_bem
    (id, empresa_id, nome, modo_controle, checklist_familia_id, exige_numero_serie, unidade_padrao) values
    (cat_estacao_a, emp_a, 'Estação total', 'INDIVIDUAL', familia_a, true, 'un'),
    (cat_notebook_a, emp_a, 'Notebook', 'INDIVIDUAL', familia_a, true, 'un'),
    (cat_andaime_a, emp_a, 'Andaime tubular', 'LOTE', familia_a, false, 'peça'),
    (cat_gerador_b, emp_b, 'Gerador', 'INDIVIDUAL', null, true, 'un');

  -- ------------------------------------------------------------ locações ----
  -- 1) Rascunho
  insert into public.locacoes (id, empresa_id, fornecedor_id, centro_custo_id, inicio_previsto, termino_previsto, observacoes)
  values (loc_rascunho_a, emp_a, forn_a1, cc_a1, current_date + 10, current_date + 70,
          '[DEMONSTRAÇÃO] Locação em rascunho');
  insert into public.itens_locacao (id, empresa_id, locacao_id, categoria_id, descricao, quantidade_contratada, valor_unitario, periodicidade)
  values (item_rasc_a, emp_a, loc_rascunho_a, cat_estacao_a, 'Estação total robótica', 2, 3500.00, 'MENSAL');
  insert into public.referencias_externas (empresa_id, locacao_id, sistema, tipo, numero, data_documento)
  values (emp_a, loc_rascunho_a, 'SECTRA', 'REQUISICAO', 'RQ-77001', current_date - 3);

  -- 2) Ativa com recebimento parcial (2 de 3 estações; 60 de 100 andaimes)
  insert into public.locacoes (id, empresa_id, fornecedor_id, centro_custo_id, status, status_financeiro,
    inicio_previsto, inicio_efetivo, termino_previsto, ativada_em, ativada_por, observacoes)
  values (loc_ativa_a, emp_a, forn_a1, cc_a1, 'ATIVA', 'EM_COBRANCA',
          current_date - 40, current_date - 38, current_date + 5, now() - interval '40 days', u_compras_a,
          '[DEMONSTRAÇÃO] Locação ativa com recebimento parcial');
  insert into public.referencias_externas (empresa_id, locacao_id, sistema, tipo, numero, data_documento) values
    (emp_a, loc_ativa_a, 'SECTRA', 'PEDIDO', '4500012345', current_date - 45),
    (emp_a, loc_ativa_a, 'SECTRA', 'REQUISICAO', 'RQ-76010', current_date - 50);
  insert into public.itens_locacao (id, empresa_id, locacao_id, categoria_id, descricao, quantidade_contratada, unidade, valor_unitario, periodicidade) values
    (item_estacao_a, emp_a, loc_ativa_a, cat_estacao_a, 'Estação total Leica TS07', 3, 'un', 2800.00, 'MENSAL'),
    (item_andaime_a, emp_a, loc_ativa_a, cat_andaime_a, 'Andaime tubular 1,5 m', 100, 'peça', 1.20, 'DIARIA');

  insert into public.recebimentos (id, empresa_id, locacao_id, status, data_evento, recebido_por, local_id,
    responsavel_id, confirmado_em, confirmado_por, observacoes)
  values (rec_ativa_a, emp_a, loc_ativa_a, 'CONFIRMADO', now() - interval '38 days', u_operacao_a, local_alm_a,
          u_operacao_a, now() - interval '38 days', u_operacao_a, '[DEMONSTRAÇÃO] Recebimento parcial');

  insert into public.bens (id, empresa_id, item_locacao_id, recebimento_id, numero_serie, identificacao_fornecedor,
    status, local_atual_id, responsavel_atual_id) values
    (bem_estacao1_a, emp_a, item_estacao_a, rec_ativa_a, 'TS07-1001', 'TOPO-0001', 'EM_USO', local_obra1_a, u_resp_a),
    (bem_estacao2_a, emp_a, item_estacao_a, rec_ativa_a, 'TS07-1002', 'TOPO-0002', 'DISPONIVEL', local_alm_a, u_operacao_a);
  insert into public.lotes (id, empresa_id, item_locacao_id, recebimento_id, quantidade_recebida, local_atual_id, responsavel_atual_id)
  values (lote_andaime_a, emp_a, item_andaime_a, rec_ativa_a, 60, local_obra2_a, u_operacao_a);
  insert into public.itens_recebimento (empresa_id, recebimento_id, item_locacao_id, bem_id, lote_id, quantidade, condicao) values
    (emp_a, rec_ativa_a, item_estacao_a, bem_estacao1_a, null, 1, 'BOM'),
    (emp_a, rec_ativa_a, item_estacao_a, bem_estacao2_a, null, 1, 'REGULAR'),
    (emp_a, rec_ativa_a, item_andaime_a, null, lote_andaime_a, 60, 'BOM');

  -- Vistorias de entrada (criadas em rascunho, respondidas, concluídas)
  insert into public.vistorias (id, empresa_id, tipo, modelo_id, bem_id, lote_id, evento_origem_tipo, evento_origem_id,
    data_evento, realizada_por) values
    (vist_bem1_a, emp_a, 'ENTRADA', modelo_a, bem_estacao1_a, null, 'RECEBIMENTO', rec_ativa_a, now() - interval '38 days', u_operacao_a),
    (vist_lote_a, emp_a, 'ENTRADA', modelo_a, null, lote_andaime_a, 'RECEBIMENTO', rec_ativa_a, now() - interval '38 days', u_operacao_a);
  insert into public.respostas_vistoria (empresa_id, vistoria_id, pergunta_id, resposta_json) values
    (emp_a, vist_bem1_a, perg_a1, '"CONFORME"'),
    (emp_a, vist_bem1_a, perg_a2, '"SIM"'),
    (emp_a, vist_bem1_a, perg_a3, '"Completos"'),
    (emp_a, vist_lote_a, perg_a1, '"CONFORME"'),
    (emp_a, vist_lote_a, perg_a2, '"SIM"');
  update public.vistorias set status = 'CONCLUIDA', concluida_em = now() - interval '38 days'
  where id in (vist_bem1_a, vist_lote_a);

  -- Movimentação confirmada: estação 1 do almoxarifado para a obra, com novo responsável
  insert into public.movimentacoes (id, empresa_id, bem_id, origem_local_id, destino_local_id, responsavel_anterior_id,
    novo_responsavel_id, data_evento, motivo, status, confirmada_em, aceita_por)
  values (mov_bem1_a, emp_a, bem_estacao1_a, local_alm_a, local_obra1_a, u_operacao_a, u_resp_a,
          now() - interval '30 days', '[DEMONSTRAÇÃO] Envio para levantamento topográfico', 'CONFIRMADA',
          now() - interval '30 days', u_resp_a);

  -- Ocorrência aberta e vencida
  insert into public.ocorrencias (id, empresa_id, locacao_id, bem_id, tipo, descricao, prioridade, responsavel_id, prazo, data_evento)
  values (ocor_bem2_a, emp_a, loc_ativa_a, bem_estacao2_a, 'AVARIA',
          '[DEMONSTRAÇÃO] Tampa da bateria trincada identificada na conferência.', 'ALTA', u_operacao_a,
          now() - interval '2 days', now() - interval '10 days');

  -- Cobrança pendente
  insert into public.cobrancas (id, empresa_id, locacao_id, competencia_inicio, competencia_fim, valor_cobrado, numero_documento, observacoes)
  values (cob_a, emp_a, loc_ativa_a, current_date - 38, current_date - 8, 5672.00, 'NF-000123',
          '[DEMONSTRAÇÃO] Primeira medição');

  -- 3) Em devolução: notebook recebido e devolução solicitada
  insert into public.locacoes (id, empresa_id, fornecedor_id, centro_custo_id, status, status_financeiro,
    inicio_previsto, inicio_efetivo, termino_previsto, ativada_em, ativada_por, desmobilizacao_iniciada_em,
    desmobilizacao_iniciada_por, observacoes)
  values (loc_devolucao_a, emp_a, forn_a2, cc_a2, 'EM_DEVOLUCAO', 'NAO_INICIADO',
          current_date - 90, current_date - 90, current_date + 20, now() - interval '90 days', u_compras_a,
          now() - interval '1 day', u_operacao_a, '[DEMONSTRAÇÃO] Locação em devolução');
  insert into public.referencias_externas (empresa_id, locacao_id, sistema, tipo, numero)
  values (emp_a, loc_devolucao_a, 'SECTRA', 'PEDIDO', '4500012399');
  insert into public.itens_locacao (id, empresa_id, locacao_id, categoria_id, descricao, quantidade_contratada, valor_unitario, periodicidade)
  values (item_notebook_a, emp_a, loc_devolucao_a, cat_notebook_a, 'Notebook i7 16 GB', 1, 450.00, 'MENSAL');
  insert into public.recebimentos (id, empresa_id, locacao_id, status, data_evento, recebido_por, local_id, responsavel_id, confirmado_em, confirmado_por)
  values (rec_devolucao_a, emp_a, loc_devolucao_a, 'CONFIRMADO', now() - interval '90 days', u_operacao_a, local_obra2_a,
          u_operacao_a, now() - interval '89 days', u_operacao_a);
  insert into public.bens (id, empresa_id, item_locacao_id, recebimento_id, numero_serie, status, local_atual_id, responsavel_atual_id)
  values (bem_notebook_a, emp_a, item_notebook_a, rec_devolucao_a, 'NB-55501', 'DEVOLUCAO_SOLICITADA', local_obra2_a, u_operacao_a);
  insert into public.itens_recebimento (empresa_id, recebimento_id, item_locacao_id, bem_id, quantidade, condicao)
  values (emp_a, rec_devolucao_a, item_notebook_a, bem_notebook_a, 1, 'NOVO');
  insert into public.devolucoes (id, empresa_id, locacao_id, status, solicitada_em, solicitada_por, observacoes)
  values (dev_a, emp_a, loc_devolucao_a, 'SOLICITADA', now() - interval '1 day', u_operacao_a,
          '[DEMONSTRAÇÃO] Devolução total solicitada');
  insert into public.itens_devolucao (empresa_id, devolucao_id, item_locacao_id, bem_id, quantidade_solicitada, status_anterior_bem)
  values (emp_a, dev_a, item_notebook_a, bem_notebook_a, 1, 'EM_USO');

  -- ------------------------------------------------------------ Empresa B ---
  -- Mesmo número de pedido Sectra da Empresa A: permitido entre empresas (S-02).
  insert into public.locacoes (id, empresa_id, fornecedor_id, centro_custo_id, status, inicio_previsto, inicio_efetivo,
    termino_previsto, ativada_em, ativada_por, observacoes)
  values (loc_ativa_b, emp_b, forn_b1, cc_b1, 'ATIVA', current_date - 15, current_date - 15, current_date + 15,
          now() - interval '15 days', u_admin_b, '[DEMONSTRAÇÃO] Locação da Empresa B');
  insert into public.referencias_externas (empresa_id, locacao_id, sistema, tipo, numero)
  values (emp_b, loc_ativa_b, 'SECTRA', 'PEDIDO', '4500012345');
  insert into public.itens_locacao (id, empresa_id, locacao_id, categoria_id, descricao, quantidade_contratada, valor_unitario, periodicidade)
  values (item_gerador_b, emp_b, loc_ativa_b, cat_gerador_b, 'Gerador 150 kVA', 1, 9000.00, 'MENSAL');
  insert into public.recebimentos (id, empresa_id, locacao_id, status, data_evento, recebido_por, local_id, responsavel_id, confirmado_em, confirmado_por)
  values (rec_b, emp_b, loc_ativa_b, 'CONFIRMADO', now() - interval '15 days', u_operacao_b, local_b2, u_operacao_b,
          now() - interval '15 days', u_operacao_b);
  insert into public.bens (id, empresa_id, item_locacao_id, recebimento_id, numero_serie, status, local_atual_id, responsavel_atual_id)
  values (bem_gerador_b, emp_b, item_gerador_b, rec_b, 'GER-9001', 'EM_USO', local_b2, u_operacao_b);
  insert into public.itens_recebimento (empresa_id, recebimento_id, item_locacao_id, bem_id, quantidade, condicao)
  values (emp_b, rec_b, item_gerador_b, bem_gerador_b, 1, 'BOM');

  raise notice 'Seed de demonstração aplicado.';
end
$seed$;
