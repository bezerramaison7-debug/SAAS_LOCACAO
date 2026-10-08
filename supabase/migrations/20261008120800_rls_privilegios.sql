-- =============================================================================
-- 009 — Row Level Security e privilégios mínimos (docs/permissions.md §4).
--
-- Camadas no banco:
--   1. GRANTs: anon não tem acesso a nada; authenticated recebe SELECT e
--      INSERT/UPDATE apenas nas COLUNAS editáveis. status, local/responsável
--      atuais, quantidades, codigo e campos de autoria nunca são graváveis
--      diretamente (D-04). DELETE só em linhas de rascunho (D-31).
--   2. RLS por operação: empresa do registro + associação ativa + permissão.
--   3. Triggers (migration 007): transições, imutabilidade, consistência.
-- =============================================================================

-- O Supabase concede ALL em public a anon/authenticated por padrão: revogar.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated, public;
revoke all on all functions in schema privado from anon, authenticated, public;
grant execute on function privado.transicao_permitida(text, text, text) to authenticated, service_role;
grant execute on function
  privado.usuario_pertence_empresa(uuid), privado.usuario_papel(uuid),
  privado.usuario_tem_permissao(uuid, text), privado.empresas_do_usuario()
to authenticated, service_role;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated, public;

-- service_role (servidor) mantém acesso para storage, administração de
-- usuários e worker de relatórios (D-07). Ignora RLS por definição.
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant select, insert, update on all tables in schema privado to service_role;

-- Funções públicas utilitárias.
grant execute on function public.usuario_pertence_empresa(uuid) to authenticated;
grant execute on function public.consumir_limite_taxa(text) to authenticated;
grant execute on function public.status_bem_ativo(public.status_bem) to authenticated, service_role;

-- RLS em TODAS as tabelas de public (um teste falha se alguma ficar sem).
do $$
declare
  t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end
$$;

-- ----------------------------------------------- escopo RESPONSAVEL_LOCAL ----
-- Leitura geral = qualquer papel exceto RESPONSAVEL_LOCAL (permissão dados.ler_geral).
create function privado.pode_ler(p_empresa uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select privado.usuario_tem_permissao(p_empresa, 'dados.ler_geral')
$$;

create function privado.ve_bem(p_bem uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bens b
    where b.id = p_bem
      and privado.usuario_pertence_empresa(b.empresa_id)
      and (
        b.responsavel_atual_id = (select auth.uid())
        or exists (
          select 1 from public.movimentacoes m
          where m.bem_id = b.id and m.status = 'PENDENTE_ACEITE'
            and m.novo_responsavel_id = (select auth.uid())
        )
      )
  )
$$;

create function privado.ve_lote(p_lote uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.lotes l
    where l.id = p_lote
      and privado.usuario_pertence_empresa(l.empresa_id)
      and (
        l.responsavel_atual_id = (select auth.uid())
        or exists (
          select 1 from public.movimentacoes m
          where m.lote_id = l.id and m.status = 'PENDENTE_ACEITE'
            and m.novo_responsavel_id = (select auth.uid())
        )
      )
  )
$$;

create function privado.ve_locacao_por_item(p_locacao uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
      select 1 from public.bens b join public.itens_locacao i on i.id = b.item_locacao_id
      where i.locacao_id = p_locacao and privado.ve_bem(b.id))
    or exists (
      select 1 from public.lotes l join public.itens_locacao i on i.id = l.item_locacao_id
      where i.locacao_id = p_locacao and privado.ve_lote(l.id))
$$;

create function privado.ve_entidade(p_tipo public.entidade_evidencia, p_id uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select case p_tipo
    when 'BEM' then privado.ve_bem(p_id)
    when 'LOTE' then privado.ve_lote(p_id)
    when 'VISTORIA' then exists (
      select 1 from public.vistorias v where v.id = p_id
        and (privado.ve_bem(v.bem_id) or privado.ve_lote(v.lote_id)))
    when 'MOVIMENTACAO' then exists (
      select 1 from public.movimentacoes m where m.id = p_id
        and privado.usuario_pertence_empresa(m.empresa_id)
        and (select auth.uid()) in (m.novo_responsavel_id, m.responsavel_anterior_id))
    when 'OCORRENCIA' then exists (
      select 1 from public.ocorrencias o where o.id = p_id
        and privado.usuario_pertence_empresa(o.empresa_id)
        and (o.created_by = (select auth.uid()) or privado.ve_bem(o.bem_id) or privado.ve_lote(o.lote_id)))
    else false
  end
$$;

grant execute on function
  privado.pode_ler(uuid), privado.ve_bem(uuid), privado.ve_lote(uuid),
  privado.ve_locacao_por_item(uuid), privado.ve_entidade(public.entidade_evidencia, uuid)
to authenticated;

-- ------------------------------------------------------ empresa e usuários ---
grant select on public.empresas to authenticated;
grant update (nome, documento, timezone, exige_aceite_movimentacao, limite_atraso_horas,
              limite_upload_imagem_mb, limite_upload_pdf_mb) on public.empresas to authenticated;
create policy empresas_select on public.empresas for select to authenticated
  using (privado.usuario_pertence_empresa(id));
create policy empresas_update on public.empresas for update to authenticated
  using (privado.usuario_tem_permissao(id, 'empresa.configurar'))
  with check (privado.usuario_tem_permissao(id, 'empresa.configurar'));

grant select on public.perfis_usuario to authenticated;
grant update (nome, telefone) on public.perfis_usuario to authenticated;
create policy perfis_select on public.perfis_usuario for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.usuarios_empresa ue
      where ue.user_id = perfis_usuario.user_id
        and ue.empresa_id in (select privado.empresas_do_usuario())
    )
  );
create policy perfis_update on public.perfis_usuario for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Membros veem as associações da empresa (necessário para escolher responsável).
-- Alterações de papel/associação: somente funções administrativas (Fase 3).
grant select on public.usuarios_empresa to authenticated;
create policy usuarios_empresa_select on public.usuarios_empresa for select to authenticated
  using (privado.usuario_pertence_empresa(empresa_id));

-- --------------------------------------------------------------- cadastros ---
grant select on public.fornecedores, public.locais, public.centros_custo, public.categorias_bem,
  public.modelos_checklist, public.perguntas_checklist to authenticated;

grant insert (empresa_id, razao_social, nome_fantasia, documento, contato, observacoes, ativo),
      update (razao_social, nome_fantasia, documento, contato, observacoes, ativo)
  on public.fornecedores to authenticated;
grant insert (empresa_id, codigo, nome, tipo, endereco, ativo), update (nome, tipo, endereco, ativo)
  on public.locais to authenticated;
grant insert (empresa_id, codigo, nome, ativo), update (nome, ativo)
  on public.centros_custo to authenticated;
grant insert (empresa_id, nome, modo_controle, checklist_familia_id, exige_numero_serie, exige_placa,
              exige_ident_fornecedor, exige_vistoria_saida, unidade_padrao, ativo),
      update (nome, checklist_familia_id, exige_numero_serie, exige_placa, exige_ident_fornecedor,
              exige_vistoria_saida, unidade_padrao, ativo)
  on public.categorias_bem to authenticated;
grant insert (empresa_id, familia_id, versao, nome, descricao), update (nome, descricao)
  on public.modelos_checklist to authenticated;
grant insert (empresa_id, modelo_id, ordem, texto, tipo_resposta, opcoes, obrigatoria, exige_foto_se),
      update (ordem, texto, tipo_resposta, opcoes, obrigatoria, exige_foto_se), delete
  on public.perguntas_checklist to authenticated;

do $$
declare
  r record;
begin
  for r in select * from (values
    ('fornecedores', 'fornecedor.gerenciar'),
    ('locais', 'local.gerenciar'),
    ('centros_custo', 'centro_custo.gerenciar'),
    ('categorias_bem', 'categoria.gerenciar'),
    ('modelos_checklist', 'checklist.gerenciar')
  ) as v (tabela, permissao) loop
    execute format(
      'create policy %1$s_select on public.%1$I for select to authenticated
         using (privado.usuario_pertence_empresa(empresa_id))', r.tabela);
    execute format(
      'create policy %1$s_insert on public.%1$I for insert to authenticated
         with check (privado.usuario_tem_permissao(empresa_id, %2$L))', r.tabela, r.permissao);
    execute format(
      'create policy %1$s_update on public.%1$I for update to authenticated
         using (privado.usuario_tem_permissao(empresa_id, %2$L))
         with check (privado.usuario_tem_permissao(empresa_id, %2$L))', r.tabela, r.permissao);
  end loop;
end
$$;

create policy perguntas_checklist_select on public.perguntas_checklist for select to authenticated
  using (privado.usuario_pertence_empresa(empresa_id));
create policy perguntas_checklist_insert on public.perguntas_checklist for insert to authenticated
  with check (privado.usuario_tem_permissao(empresa_id, 'checklist.gerenciar'));
create policy perguntas_checklist_update on public.perguntas_checklist for update to authenticated
  using (privado.usuario_tem_permissao(empresa_id, 'checklist.gerenciar'))
  with check (privado.usuario_tem_permissao(empresa_id, 'checklist.gerenciar'));
create policy perguntas_checklist_delete on public.perguntas_checklist for delete to authenticated
  using (privado.usuario_tem_permissao(empresa_id, 'checklist.gerenciar'));

-- ---------------------------------------------------------------- locações ---
grant select on public.locacoes to authenticated;
grant insert (empresa_id, fornecedor_id, centro_custo_id, inicio_previsto, termino_previsto, observacoes),
      update (fornecedor_id, centro_custo_id, inicio_previsto, termino_previsto, observacoes)
  on public.locacoes to authenticated;
create policy locacoes_select on public.locacoes for select to authenticated
  using (privado.pode_ler(empresa_id) or privado.ve_locacao_por_item(id));
create policy locacoes_insert on public.locacoes for insert to authenticated
  with check (privado.usuario_tem_permissao(empresa_id, 'locacao.criar'));
-- Após a ativação, alterações só por função de domínio (aditivo, com motivo — D-14).
create policy locacoes_update on public.locacoes for update to authenticated
  using (status = 'RASCUNHO' and privado.usuario_tem_permissao(empresa_id, 'locacao.editar'))
  with check (status = 'RASCUNHO' and privado.usuario_tem_permissao(empresa_id, 'locacao.editar'));

grant select on public.referencias_externas to authenticated;
grant insert (empresa_id, locacao_id, sistema, tipo, numero, data_documento, observacao),
      update (sistema, tipo, numero, data_documento, observacao), delete
  on public.referencias_externas to authenticated;
create policy referencias_select on public.referencias_externas for select to authenticated
  using (privado.pode_ler(empresa_id));
create policy referencias_insert on public.referencias_externas for insert to authenticated
  with check (
    privado.usuario_tem_permissao(empresa_id, 'locacao.referencia.gerenciar')
    and exists (select 1 from public.locacoes l where l.id = locacao_id
                and l.status in ('RASCUNHO', 'ATIVA', 'EM_DEVOLUCAO'))
  );
create policy referencias_update on public.referencias_externas for update to authenticated
  using (
    privado.usuario_tem_permissao(empresa_id, 'locacao.referencia.gerenciar')
    and exists (select 1 from public.locacoes l where l.id = locacao_id
                and l.status in ('RASCUNHO', 'ATIVA', 'EM_DEVOLUCAO'))
  )
  with check (privado.usuario_tem_permissao(empresa_id, 'locacao.referencia.gerenciar'));
create policy referencias_delete on public.referencias_externas for delete to authenticated
  using (
    privado.usuario_tem_permissao(empresa_id, 'locacao.referencia.gerenciar')
    and exists (select 1 from public.locacoes l where l.id = locacao_id and l.status = 'RASCUNHO')
  );

-- Itens contêm valores: RESPONSAVEL_LOCAL não lê (S-08).
grant select on public.itens_locacao to authenticated;
grant insert (empresa_id, locacao_id, categoria_id, descricao, quantidade_contratada, unidade,
              valor_unitario, periodicidade, observacao),
      update (categoria_id, descricao, quantidade_contratada, unidade, valor_unitario, periodicidade, observacao),
      delete
  on public.itens_locacao to authenticated;
create policy itens_locacao_select on public.itens_locacao for select to authenticated
  using (privado.usuario_tem_permissao(empresa_id, 'valores.ver'));
create policy itens_locacao_insert on public.itens_locacao for insert to authenticated
  with check (
    privado.usuario_tem_permissao(empresa_id, 'locacao.editar')
    and exists (select 1 from public.locacoes l where l.id = locacao_id and l.status = 'RASCUNHO')
  );
create policy itens_locacao_update on public.itens_locacao for update to authenticated
  using (
    privado.usuario_tem_permissao(empresa_id, 'locacao.editar')
    and exists (select 1 from public.locacoes l where l.id = locacao_id and l.status = 'RASCUNHO')
  )
  with check (privado.usuario_tem_permissao(empresa_id, 'locacao.editar'));
create policy itens_locacao_delete on public.itens_locacao for delete to authenticated
  using (
    privado.usuario_tem_permissao(empresa_id, 'locacao.editar')
    and exists (select 1 from public.locacoes l where l.id = locacao_id and l.status = 'RASCUNHO')
  );

-- ------------------------------------------------------------ recebimentos ---
grant select on public.recebimentos to authenticated;
grant insert (empresa_id, locacao_id, data_evento, local_id, responsavel_id, observacoes),
      update (data_evento, local_id, responsavel_id, observacoes)
  on public.recebimentos to authenticated;
create policy recebimentos_select on public.recebimentos for select to authenticated
  using (privado.pode_ler(empresa_id));
create policy recebimentos_insert on public.recebimentos for insert to authenticated
  with check (
    privado.usuario_tem_permissao(empresa_id, 'recebimento.registrar')
    and exists (select 1 from public.locacoes l where l.id = locacao_id and l.status = 'ATIVA')
  );
create policy recebimentos_update on public.recebimentos for update to authenticated
  using (status = 'RASCUNHO' and privado.usuario_tem_permissao(empresa_id, 'recebimento.registrar'))
  with check (status = 'RASCUNHO' and privado.usuario_tem_permissao(empresa_id, 'recebimento.registrar'));

grant select on public.itens_recebimento to authenticated;
grant insert (empresa_id, recebimento_id, item_locacao_id, bem_id, quantidade, condicao, observacao),
      update (quantidade, condicao, observacao), delete
  on public.itens_recebimento to authenticated;
create policy itens_recebimento_select on public.itens_recebimento for select to authenticated
  using (privado.pode_ler(empresa_id));
create policy itens_recebimento_insert on public.itens_recebimento for insert to authenticated
  with check (
    privado.usuario_tem_permissao(empresa_id, 'recebimento.registrar')
    and exists (select 1 from public.recebimentos r where r.id = recebimento_id and r.status = 'RASCUNHO')
  );
create policy itens_recebimento_update on public.itens_recebimento for update to authenticated
  using (
    privado.usuario_tem_permissao(empresa_id, 'recebimento.registrar')
    and exists (select 1 from public.recebimentos r where r.id = recebimento_id and r.status = 'RASCUNHO')
  )
  with check (privado.usuario_tem_permissao(empresa_id, 'recebimento.registrar'));
create policy itens_recebimento_delete on public.itens_recebimento for delete to authenticated
  using (
    privado.usuario_tem_permissao(empresa_id, 'recebimento.registrar')
    and exists (select 1 from public.recebimentos r where r.id = recebimento_id and r.status = 'RASCUNHO')
  );

-- ----------------------------------------------------------- bens e lotes ----
-- Bens nascem no rascunho do recebimento (AGUARDANDO_RECEBIMENTO); status,
-- local e responsável só mudam por funções de domínio.
grant select on public.bens, public.lotes to authenticated;
grant insert (empresa_id, item_locacao_id, recebimento_id, identificacao_fornecedor, numero_serie, placa, observacoes),
      update (identificacao_fornecedor, numero_serie, placa, observacoes)
  on public.bens to authenticated;
create policy bens_select on public.bens for select to authenticated
  using (privado.pode_ler(empresa_id) or privado.ve_bem(id));
create policy bens_insert on public.bens for insert to authenticated
  with check (
    privado.usuario_tem_permissao(empresa_id, 'recebimento.registrar')
    and exists (select 1 from public.recebimentos r where r.id = recebimento_id and r.status = 'RASCUNHO')
  );
create policy bens_update on public.bens for update to authenticated
  using (status = 'AGUARDANDO_RECEBIMENTO' and privado.usuario_tem_permissao(empresa_id, 'recebimento.registrar'))
  with check (status = 'AGUARDANDO_RECEBIMENTO' and privado.usuario_tem_permissao(empresa_id, 'recebimento.registrar'));
create policy lotes_select on public.lotes for select to authenticated
  using (privado.pode_ler(empresa_id) or privado.ve_lote(id));

-- ---------------------------------------------------------------- vistorias --
grant select on public.vistorias, public.respostas_vistoria to authenticated;
grant insert (empresa_id, tipo, modelo_id, bem_id, lote_id, evento_origem_tipo, evento_origem_id,
              data_evento, observacao),
      update (data_evento, observacao)
  on public.vistorias to authenticated;
grant insert (empresa_id, vistoria_id, pergunta_id, resposta_json, observacao),
      update (resposta_json, observacao), delete
  on public.respostas_vistoria to authenticated;
create policy vistorias_select on public.vistorias for select to authenticated
  using (privado.pode_ler(empresa_id) or privado.ve_bem(bem_id) or privado.ve_lote(lote_id));
create policy vistorias_insert on public.vistorias for insert to authenticated
  with check (privado.usuario_tem_permissao(empresa_id, 'vistoria.registrar'));
create policy vistorias_update on public.vistorias for update to authenticated
  using (status = 'RASCUNHO' and privado.usuario_tem_permissao(empresa_id, 'vistoria.registrar'))
  with check (status = 'RASCUNHO' and privado.usuario_tem_permissao(empresa_id, 'vistoria.registrar'));
create policy respostas_select on public.respostas_vistoria for select to authenticated
  using (exists (select 1 from public.vistorias v where v.id = vistoria_id));
create policy respostas_insert on public.respostas_vistoria for insert to authenticated
  with check (privado.usuario_tem_permissao(empresa_id, 'vistoria.registrar'));
create policy respostas_update on public.respostas_vistoria for update to authenticated
  using (privado.usuario_tem_permissao(empresa_id, 'vistoria.registrar'))
  with check (privado.usuario_tem_permissao(empresa_id, 'vistoria.registrar'));
create policy respostas_delete on public.respostas_vistoria for delete to authenticated
  using (privado.usuario_tem_permissao(empresa_id, 'vistoria.registrar'));

-- ------------------------------------------- movimentações e ocorrências -----
-- Somente leitura direta; criação/aceite/resolução por funções de domínio.
grant select on public.movimentacoes, public.ocorrencias to authenticated;
create policy movimentacoes_select on public.movimentacoes for select to authenticated
  using (
    privado.pode_ler(empresa_id)
    or (privado.usuario_pertence_empresa(empresa_id)
        and (select auth.uid()) in (novo_responsavel_id, responsavel_anterior_id))
  );
create policy ocorrencias_select on public.ocorrencias for select to authenticated
  using (
    privado.pode_ler(empresa_id)
    or (privado.usuario_pertence_empresa(empresa_id)
        and (created_by = (select auth.uid()) or privado.ve_bem(bem_id) or privado.ve_lote(lote_id)))
  );

-- --------------------------------------------------------------- devoluções --
grant select on public.devolucoes, public.itens_devolucao to authenticated;
grant insert (empresa_id, locacao_id, observacoes), update (observacoes)
  on public.devolucoes to authenticated;
grant insert (empresa_id, devolucao_id, item_locacao_id, bem_id, lote_id, quantidade_solicitada, observacao),
      update (quantidade_solicitada, observacao), delete
  on public.itens_devolucao to authenticated;
create policy devolucoes_select on public.devolucoes for select to authenticated
  using (privado.pode_ler(empresa_id));
create policy devolucoes_insert on public.devolucoes for insert to authenticated
  with check (
    privado.usuario_tem_permissao(empresa_id, 'devolucao.gerenciar')
    and exists (select 1 from public.locacoes l where l.id = locacao_id and l.status in ('ATIVA', 'EM_DEVOLUCAO'))
  );
create policy devolucoes_update on public.devolucoes for update to authenticated
  using (status = 'RASCUNHO' and privado.usuario_tem_permissao(empresa_id, 'devolucao.gerenciar'))
  with check (status = 'RASCUNHO' and privado.usuario_tem_permissao(empresa_id, 'devolucao.gerenciar'));
create policy itens_devolucao_select on public.itens_devolucao for select to authenticated
  using (privado.pode_ler(empresa_id));
create policy itens_devolucao_insert on public.itens_devolucao for insert to authenticated
  with check (
    privado.usuario_tem_permissao(empresa_id, 'devolucao.gerenciar')
    and exists (select 1 from public.devolucoes d where d.id = devolucao_id and d.status = 'RASCUNHO')
  );
create policy itens_devolucao_update on public.itens_devolucao for update to authenticated
  using (
    privado.usuario_tem_permissao(empresa_id, 'devolucao.gerenciar')
    and exists (select 1 from public.devolucoes d where d.id = devolucao_id and d.status = 'RASCUNHO')
  )
  with check (privado.usuario_tem_permissao(empresa_id, 'devolucao.gerenciar'));
create policy itens_devolucao_delete on public.itens_devolucao for delete to authenticated
  using (
    privado.usuario_tem_permissao(empresa_id, 'devolucao.gerenciar')
    and exists (select 1 from public.devolucoes d where d.id = devolucao_id and d.status = 'RASCUNHO')
  );

-- ---------------------------------------- cobranças, evidências, relatórios --
grant select on public.cobrancas, public.evidencias, public.relatorios, public.auditoria to authenticated;
create policy cobrancas_select on public.cobrancas for select to authenticated
  using (privado.usuario_tem_permissao(empresa_id, 'valores.ver'));
create policy evidencias_select on public.evidencias for select to authenticated
  using (
    privado.pode_ler(empresa_id)
    or (privado.usuario_pertence_empresa(empresa_id) and privado.ve_entidade(entidade_tipo, entidade_id))
  );
create policy relatorios_select on public.relatorios for select to authenticated
  using (
    privado.usuario_tem_permissao(empresa_id, 'relatorio.gerar')
    and (solicitado_por = (select auth.uid()) or privado.usuario_tem_permissao(empresa_id, 'auditoria.ler'))
  );
create policy auditoria_select on public.auditoria for select to authenticated
  using (empresa_id is not null and privado.usuario_tem_permissao(empresa_id, 'auditoria.ler'));

-- Visões (security_invoker): herdam a RLS das tabelas.
grant select on public.v_saldo_item_locacao, public.v_saldo_locacao to authenticated;
