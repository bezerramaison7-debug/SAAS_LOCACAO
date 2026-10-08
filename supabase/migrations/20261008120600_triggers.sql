-- =============================================================================
-- 007 — Triggers de integridade e auditoria.
--   * autoria/updated_at e empresa_id imutável
--   * códigos legíveis (LOC-000001…)
--   * guarda de transição de estado (vale inclusive para funções de domínio)
--   * auditoria genérica na mesma transação
--   * imutabilidade de registros finalizados
--   * último ADMIN ativo
--   * consistência entre tabelas (modo de controle, mesma locação, checklist)
-- Regras de fluxo ficam nas funções de domínio (fases 4–8), não aqui.
-- =============================================================================

-- ------------------------------------------------------------ autoria --------
create function privado.definir_autoria() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_novo jsonb;
begin
  if tg_op = 'INSERT' then
    v_novo := jsonb_build_object(
      'created_at', now(), 'updated_at', now(),
      'created_by', coalesce(v_uid::text, to_jsonb(new)->>'created_by'),
      'updated_by', coalesce(v_uid::text, to_jsonb(new)->>'created_by')
    );
  else
    if to_jsonb(new) ? 'empresa_id'
       and (to_jsonb(new)->>'empresa_id') is distinct from (to_jsonb(old)->>'empresa_id') then
      raise exception 'empresa_id é imutável' using errcode = '42501';
    end if;
    v_novo := jsonb_build_object(
      'created_at', to_jsonb(old)->'created_at',
      'created_by', to_jsonb(old)->'created_by',
      'updated_at', now(),
      'updated_by', coalesce(v_uid::text, to_jsonb(new)->>'updated_by')
    );
  end if;
  new := jsonb_populate_record(new, v_novo);
  return new;
end
$$;

-- ------------------------------------------------------------- códigos -------
create function privado.atribuir_codigo() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.codigo is null or new.codigo = '' then
    new.codigo := privado.proximo_codigo(new.empresa_id, tg_argv[0]);
  end if;
  return new;
end
$$;

create function privado.codigo_imutavel() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.codigo is distinct from old.codigo then
    raise exception 'Código é imutável' using errcode = '42501';
  end if;
  return new;
end
$$;

-- ------------------------------------------------ guarda de transição --------
-- tg_argv[0] = máquina, tg_argv[1] = coluna de status.
create function privado.guardar_transicao() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_de text := to_jsonb(old)->>tg_argv[1];
  v_para text := to_jsonb(new)->>tg_argv[1];
begin
  if not privado.transicao_permitida(tg_argv[0], v_de, v_para) then
    raise exception 'Transição de estado não permitida (%): % → %', tg_argv[0], v_de, v_para
      using errcode = '23514';
  end if;
  return new;
end
$$;

-- ------------------------------------------------------------ auditoria ------
create function privado.request_id_atual() returns text
language plpgsql stable
set search_path = ''
as $$
declare
  v text;
begin
  v := nullif(current_setting('app.request_id', true), '');
  if v is null then
    begin
      v := nullif(current_setting('request.headers', true), '')::json->>'x-request-id';
    exception when others then
      v := null;
    end;
  end if;
  return left(v, 64);
end
$$;

create function privado.sanitizar_auditoria(p_dados jsonb) returns jsonb
language sql immutable
set search_path = ''
as $$
  select case when p_dados is null then null else (
    select coalesce(jsonb_object_agg(chave, valor), '{}'::jsonb)
    from jsonb_each(p_dados) as e (chave, valor)
    where chave !~* '(senha|password|token|secret|segredo|chave_api|api_key|service_role|hash_senha)'
  ) end
$$;

create function privado.auditar() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_depois jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_ref jsonb := coalesce(v_depois, v_antes);
  v_empresa uuid;
begin
  -- Ignora UPDATE que não muda nada além de metadados.
  if tg_op = 'UPDATE'
     and (v_antes - 'updated_at' - 'updated_by') = (v_depois - 'updated_at' - 'updated_by') then
    return null;
  end if;
  v_empresa := case
    when tg_table_name = 'empresas' then (v_ref->>'id')::uuid
    else (v_ref->>'empresa_id')::uuid
  end;
  insert into public.auditoria
    (empresa_id, ator_id, acao, entidade_tipo, entidade_id, dados_anteriores, dados_novos, request_id)
  values (
    v_empresa,
    (select auth.uid()),
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    coalesce(v_ref->>'id', v_ref->>'user_id')::uuid,
    privado.sanitizar_auditoria(v_antes),
    privado.sanitizar_auditoria(v_depois),
    privado.request_id_atual()
  );
  return null;
end
$$;

-- Evento semântico (usado pelas funções de domínio nas próximas fases).
create function privado.registrar_auditoria(
  p_empresa uuid, p_acao text, p_entidade_tipo text, p_entidade_id uuid,
  p_antes jsonb, p_depois jsonb, p_contexto jsonb default null
) returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.auditoria
    (empresa_id, ator_id, acao, entidade_tipo, entidade_id, dados_anteriores, dados_novos, contexto, request_id)
  values (p_empresa, (select auth.uid()), p_acao, p_entidade_tipo, p_entidade_id,
          privado.sanitizar_auditoria(p_antes), privado.sanitizar_auditoria(p_depois),
          privado.sanitizar_auditoria(p_contexto), privado.request_id_atual())
$$;

-- --------------------------------------------------------- imutabilidade -----
create function privado.bloquear_alteracao() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% é somente inclusão (append-only)', tg_table_name using errcode = '42501';
end
$$;

-- tg_argv[0] = coluna de status; demais = estados finais imutáveis.
create function privado.bloquear_se_finalizado() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status text := to_jsonb(old)->>tg_argv[0];
  i integer;
begin
  for i in 1 .. tg_nargs - 1 loop
    if v_status = tg_argv[i] then
      raise exception 'Registro de % em estado % é imutável', tg_table_name, v_status
        using errcode = '42501';
    end if;
  end loop;
  return new;
end
$$;

-- Apenas as colunas listadas (tg_argv) podem mudar.
create function privado.restringir_colunas_alteraveis() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_antes jsonb := to_jsonb(old) - 'updated_at' - 'updated_by';
  v_depois jsonb := to_jsonb(new) - 'updated_at' - 'updated_by';
  i integer;
begin
  for i in 0 .. tg_nargs - 1 loop
    v_antes := v_antes - tg_argv[i];
    v_depois := v_depois - tg_argv[i];
  end loop;
  if v_antes <> v_depois then
    raise exception 'Alteração não permitida em % (somente: %)', tg_table_name, array_to_string(tg_argv, ', ')
      using errcode = '42501';
  end if;
  return new;
end
$$;

-- Modelo publicado/arquivado: só o status muda (PUBLICADO → ARQUIVADO).
create function privado.proteger_modelo_checklist() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'RASCUNHO'
     and (to_jsonb(old) - 'status' - 'updated_at' - 'updated_by')
         <> (to_jsonb(new) - 'status' - 'updated_at' - 'updated_by') then
    raise exception 'Modelo de checklist publicado é imutável; crie uma nova versão' using errcode = '42501';
  end if;
  return new;
end
$$;

-- Perguntas só mudam enquanto o modelo é RASCUNHO (RN-80).
create function privado.proteger_perguntas_checklist() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_modelo uuid := case when tg_op = 'DELETE' then old.modelo_id else new.modelo_id end;
begin
  if exists (select 1 from public.modelos_checklist m where m.id = v_modelo and m.status <> 'RASCUNHO')
     or (tg_op = 'UPDATE' and exists (
       select 1 from public.modelos_checklist m where m.id = old.modelo_id and m.status <> 'RASCUNHO')) then
    raise exception 'Perguntas de checklist publicado são imutáveis' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end
$$;

-- Respostas só mudam enquanto a vistoria é RASCUNHO e devem ser do mesmo modelo.
create function privado.proteger_respostas_vistoria() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vistoria uuid := case when tg_op = 'DELETE' then old.vistoria_id else new.vistoria_id end;
  v_status public.status_vistoria;
  v_modelo uuid;
begin
  select status, modelo_id into v_status, v_modelo from public.vistorias where id = v_vistoria;
  if v_status <> 'RASCUNHO' then
    raise exception 'Respostas de vistoria finalizada são imutáveis' using errcode = '42501';
  end if;
  if tg_op <> 'DELETE' and not exists (
    select 1 from public.perguntas_checklist p where p.id = new.pergunta_id and p.modelo_id = v_modelo) then
    raise exception 'Pergunta não pertence ao modelo da vistoria' using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end
$$;

-- ----------------------------------------------------- último ADMIN ----------
create function privado.garantir_admin_ativo() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.papel = 'ADMIN' and old.ativo
     and not exists (
       select 1 from public.usuarios_empresa
       where empresa_id = old.empresa_id and papel = 'ADMIN' and ativo
     ) then
    raise exception 'A empresa precisa manter ao menos um ADMIN ativo' using errcode = '23514';
  end if;
  return null;
end
$$;

-- ------------------------------------------- consistência entre tabelas ------
create function privado.herdar_modo_controle() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_modo public.modo_controle;
begin
  select modo_controle into v_modo
  from public.categorias_bem where id = new.categoria_id and empresa_id = new.empresa_id;
  if v_modo is null then
    raise exception 'Categoria inexistente nesta empresa' using errcode = '23503';
  end if;
  new.modo_controle := v_modo;
  return new;
end
$$;

-- tg_argv[0] = modo exigido do item ('INDIVIDUAL' para bens, 'LOTE' para lotes).
create function privado.validar_modo_item() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.itens_locacao i
    where i.id = new.item_locacao_id and i.modo_controle::text = tg_argv[0]) then
    raise exception 'Item de locação não é de controle %', tg_argv[0] using errcode = '23514';
  end if;
  return new;
end
$$;

-- Item/bem/lote precisam pertencer à mesma locação do documento-pai.
-- tg_argv[0] = tabela-pai (recebimentos | devolucoes), tg_argv[1] = coluna FK do pai.
create function privado.validar_mesma_locacao() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locacao_pai uuid;
  v_dados jsonb := to_jsonb(new);
begin
  execute format('select locacao_id from public.%I where id = $1', tg_argv[0])
    into v_locacao_pai using (v_dados->>tg_argv[1])::uuid;
  if not exists (select 1 from public.itens_locacao i
                 where i.id = (v_dados->>'item_locacao_id')::uuid and i.locacao_id = v_locacao_pai) then
    raise exception 'Item não pertence à locação do documento' using errcode = '23514';
  end if;
  if v_dados->>'bem_id' is not null and not exists (
    select 1 from public.bens b where b.id = (v_dados->>'bem_id')::uuid
      and b.item_locacao_id = (v_dados->>'item_locacao_id')::uuid) then
    raise exception 'Bem não pertence ao item informado' using errcode = '23514';
  end if;
  if v_dados->>'lote_id' is not null and not exists (
    select 1 from public.lotes l where l.id = (v_dados->>'lote_id')::uuid
      and l.item_locacao_id = (v_dados->>'item_locacao_id')::uuid) then
    raise exception 'Lote não pertence ao item informado' using errcode = '23514';
  end if;
  return new;
end
$$;

create function privado.validar_alvo_ocorrencia() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.bem_id is not null and not exists (
    select 1 from public.bens b join public.itens_locacao i on i.id = b.item_locacao_id
    where b.id = new.bem_id and i.locacao_id = new.locacao_id) then
    raise exception 'Bem não pertence à locação da ocorrência' using errcode = '23514';
  end if;
  if new.lote_id is not null and not exists (
    select 1 from public.lotes l join public.itens_locacao i on i.id = l.item_locacao_id
    where l.id = new.lote_id and i.locacao_id = new.locacao_id) then
    raise exception 'Lote não pertence à locação da ocorrência' using errcode = '23514';
  end if;
  if new.recebimento_id is not null and not exists (
    select 1 from public.recebimentos r where r.id = new.recebimento_id and r.locacao_id = new.locacao_id) then
    raise exception 'Recebimento não pertence à locação da ocorrência' using errcode = '23514';
  end if;
  return new;
end
$$;

create function privado.validar_vistoria() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.modelos_checklist m
                 where m.id = new.modelo_id and m.status = 'PUBLICADO') then
    raise exception 'Vistoria exige um modelo de checklist publicado' using errcode = '23514';
  end if;
  return new;
end
$$;

-- ---------------------------------------------------- aplicação geral --------
do $$
declare
  t text;
begin
  -- autoria + updated_at em todas as tabelas de negócio
  foreach t in array array[
    'empresas', 'perfis_usuario', 'usuarios_empresa', 'fornecedores', 'locais', 'centros_custo',
    'modelos_checklist', 'perguntas_checklist', 'categorias_bem', 'locacoes', 'referencias_externas',
    'itens_locacao', 'recebimentos', 'bens', 'lotes', 'itens_recebimento', 'vistorias',
    'respostas_vistoria', 'movimentacoes', 'ocorrencias', 'devolucoes', 'itens_devolucao',
    'cobrancas', 'evidencias', 'relatorios'
  ] loop
    execute format(
      'create trigger %1$s_autoria before insert or update on public.%1$I
         for each row execute function privado.definir_autoria()', t);
    execute format(
      'create trigger %1$s_auditoria after insert or update or delete on public.%1$I
         for each row execute function privado.auditar()', t);
  end loop;
end
$$;

do $$
declare
  r record;
begin
  for r in select * from (values
    ('locacoes', 'LOC'), ('bens', 'BEM'), ('lotes', 'LOT'), ('recebimentos', 'REC'),
    ('movimentacoes', 'MOV'), ('ocorrencias', 'OCR'), ('devolucoes', 'DEV'),
    ('cobrancas', 'COB'), ('relatorios', 'REL')
  ) as v (tabela, prefixo) loop
    execute format(
      'create trigger %1$s_codigo before insert on public.%1$I
         for each row execute function privado.atribuir_codigo(%2$L)', r.tabela, r.prefixo);
    execute format(
      'create trigger %1$s_codigo_imutavel before update of codigo on public.%1$I
         for each row execute function privado.codigo_imutavel()', r.tabela);
  end loop;

  for r in select * from (values
    ('locacoes', 'locacao', 'status'), ('locacoes', 'financeiro', 'status_financeiro'),
    ('bens', 'bem', 'status'), ('lotes', 'lote', 'status'),
    ('recebimentos', 'recebimento', 'status'), ('vistorias', 'vistoria', 'status'),
    ('movimentacoes', 'movimentacao', 'status'), ('ocorrencias', 'ocorrencia', 'status'),
    ('devolucoes', 'devolucao', 'status'), ('cobrancas', 'cobranca', 'status'),
    ('relatorios', 'relatorio', 'status'), ('modelos_checklist', 'checklist', 'status')
  ) as v (tabela, maquina, coluna) loop
    execute format(
      'create trigger %1$s_transicao_%2$s before update of %3$I on public.%1$I
         for each row execute function privado.guardar_transicao(%2$L, %3$L)',
      r.tabela, r.maquina, r.coluna);
  end loop;
end
$$;

-- Auditoria: append-only (nem service_role altera pelo fluxo normal).
create trigger auditoria_append_only before update or delete on public.auditoria
  for each row execute function privado.bloquear_alteracao();

-- Registros finalizados.
create trigger movimentacoes_imutavel before update on public.movimentacoes
  for each row execute function privado.bloquear_se_finalizado('status', 'CONFIRMADA', 'RECUSADA', 'CANCELADA');
create trigger vistorias_imutavel before update on public.vistorias
  for each row execute function privado.bloquear_se_finalizado('status', 'CONCLUIDA', 'CANCELADA');
create trigger relatorios_imutavel before update on public.relatorios
  for each row execute function privado.bloquear_se_finalizado('status', 'CONCLUIDO');
create trigger devolucoes_cancelada_imutavel before update on public.devolucoes
  for each row execute function privado.bloquear_se_finalizado('status', 'CANCELADA');
create trigger cobrancas_resolvida_imutavel before update on public.cobrancas
  for each row execute function privado.bloquear_se_finalizado('status', 'RESOLVIDA');
-- Evidência: só o ciclo de vida (substituição/remoção lógica) pode mudar (RN-95).
create trigger evidencias_conteudo_imutavel before update on public.evidencias
  for each row execute function privado.restringir_colunas_alteraveis(
    'status', 'substituida_por_id', 'motivo_remocao', 'removida_em', 'removida_por', 'legenda');
create trigger modelos_checklist_imutavel before update on public.modelos_checklist
  for each row execute function privado.proteger_modelo_checklist();
create trigger perguntas_checklist_imutavel before insert or update or delete on public.perguntas_checklist
  for each row execute function privado.proteger_perguntas_checklist();
create trigger respostas_vistoria_imutavel before insert or update or delete on public.respostas_vistoria
  for each row execute function privado.proteger_respostas_vistoria();

create trigger usuarios_empresa_admin_ativo after update or delete on public.usuarios_empresa
  for each row execute function privado.garantir_admin_ativo();

create trigger itens_locacao_modo before insert or update of categoria_id, modo_controle on public.itens_locacao
  for each row execute function privado.herdar_modo_controle();
create trigger bens_modo_item before insert or update of item_locacao_id on public.bens
  for each row execute function privado.validar_modo_item('INDIVIDUAL');
create trigger lotes_modo_item before insert or update of item_locacao_id on public.lotes
  for each row execute function privado.validar_modo_item('LOTE');
create trigger itens_recebimento_mesma_locacao before insert or update on public.itens_recebimento
  for each row execute function privado.validar_mesma_locacao('recebimentos', 'recebimento_id');
create trigger itens_devolucao_mesma_locacao before insert or update on public.itens_devolucao
  for each row execute function privado.validar_mesma_locacao('devolucoes', 'devolucao_id');
create trigger ocorrencias_alvo before insert or update of bem_id, lote_id, recebimento_id, locacao_id
  on public.ocorrencias for each row execute function privado.validar_alvo_ocorrencia();
create trigger vistorias_modelo_publicado before insert or update of modelo_id on public.vistorias
  for each row execute function privado.validar_vistoria();
