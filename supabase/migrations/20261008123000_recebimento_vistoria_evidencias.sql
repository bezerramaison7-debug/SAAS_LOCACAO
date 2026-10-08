-- =============================================================================
-- 013 — Fase 5: recebimento (rascunho → confirmação transacional), vistoria de
--        entrada com checklist versionado e evidências privadas.
-- Convenções (D-04): security definer, search_path vazio, empresa derivada da
-- linha-alvo, permissão revalidada, linha travada (for update), auditoria
-- semântica. Erros: 42501 · P0002 · 22023 (mensagem operacional) · 23514.
-- =============================================================================

-- ------------------------------------------------------ ajustes de esquema ---
-- Vistoria de entrada é feita sobre a LINHA do recebimento enquanto ele é
-- rascunho (o lote só nasce na confirmação — D-33). Na confirmação a vistoria
-- é vinculada ao bem/lote criado e concluída na mesma transação (D-47).
alter table public.vistorias add column item_recebimento_id uuid;
alter table public.vistorias
  add constraint vistorias_item_recebimento_fk
  foreign key (empresa_id, item_recebimento_id) references public.itens_recebimento (empresa_id, id);
create index vistorias_item_recebimento_idx on public.vistorias (empresa_id, item_recebimento_id)
  where item_recebimento_id is not null;
-- Uma vistoria de entrada ativa por linha.
create unique index vistorias_entrada_linha_uk on public.vistorias (item_recebimento_id)
  where item_recebimento_id is not null and status <> 'CANCELADA';

do $$
declare
  v_nome text;
begin
  select conname into v_nome from pg_constraint
  where conrelid = 'public.vistorias'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%(bem_id IS NULL) <> (lote_id IS NULL)%';
  execute format('alter table public.vistorias drop constraint %I', v_nome);
end
$$;
alter table public.vistorias
  add constraint vistorias_alvo_unico check (num_nonnulls(bem_id, lote_id) <= 1),
  add constraint vistorias_alvo_presente check (status = 'CANCELADA' or num_nonnulls(bem_id, lote_id, item_recebimento_id) >= 1),
  add constraint vistorias_concluida_com_alvo check (status <> 'CONCLUIDA' or num_nonnulls(bem_id, lote_id) = 1);

-- RN-24: um lote por (recebimento, item).
create unique index itens_recebimento_item_lote_uk on public.itens_recebimento (recebimento_id, item_locacao_id)
  where bem_id is null;

-- Vistorias são criadas pela função de domínio (versão vigente resolvida no banco).
revoke insert on public.vistorias from authenticated;

-- ------------------------------------------- validação de respostas ---------
create function privado.validar_resposta_vistoria() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.perguntas_checklist;
  v_valor text;
begin
  select * into p from public.perguntas_checklist where id = new.pergunta_id;
  if jsonb_typeof(new.resposta_json) = 'null' then
    raise exception 'Resposta vazia' using errcode = '22023';
  end if;
  v_valor := new.resposta_json #>> '{}';
  if p.tipo_resposta = 'NUMERO' then
    if jsonb_typeof(new.resposta_json) <> 'number' then
      raise exception 'Resposta deve ser um número' using errcode = '22023';
    end if;
  elsif jsonb_typeof(new.resposta_json) <> 'string' then
    raise exception 'Resposta inválida' using errcode = '22023';
  elsif p.tipo_resposta = 'SIM_NAO' and v_valor not in ('SIM', 'NAO') then
    raise exception 'Responda Sim ou Não' using errcode = '22023';
  elsif p.tipo_resposta = 'CONFORME_NAO_CONFORME' and v_valor not in ('CONFORME', 'NAO_CONFORME') then
    raise exception 'Responda Conforme ou Não conforme' using errcode = '22023';
  elsif p.tipo_resposta = 'OPCAO_UNICA' and not (p.opcoes ? v_valor) then
    raise exception 'Opção inexistente nesta pergunta' using errcode = '22023';
  elsif p.tipo_resposta = 'TEXTO' and length(trim(v_valor)) not between 1 and 1000 then
    raise exception 'Texto deve ter de 1 a 1000 caracteres' using errcode = '22023';
  end if;
  return new;
end
$$;
create trigger respostas_vistoria_valor before insert or update of resposta_json, pergunta_id
  on public.respostas_vistoria for each row execute function privado.validar_resposta_vistoria();

-- ------------------------------------------------- pendências de vistoria ---
-- RN-83: obrigatórias respondidas e fotos exigidas anexadas (evidência ATIVA,
-- tipo FOTO, da vistoria, vinculada à pergunta).
create function privado.pendencias_vistoria(p_vistoria uuid) returns text[]
language sql stable security definer
set search_path = ''
as $$
  select coalesce(array_agg(msg order by ordem), '{}')
  from (
    select p.ordem, format('Pergunta %s: resposta obrigatória', p.ordem) as msg
    from public.vistorias v
    join public.perguntas_checklist p on p.modelo_id = v.modelo_id
    left join public.respostas_vistoria r on r.vistoria_id = v.id and r.pergunta_id = p.id
    where v.id = p_vistoria and p.obrigatoria and r.id is null
    union all
    select p.ordem, format('Pergunta %s: anexe a foto exigida', p.ordem)
    from public.vistorias v
    join public.perguntas_checklist p on p.modelo_id = v.modelo_id
    join public.respostas_vistoria r on r.vistoria_id = v.id and r.pergunta_id = p.id
    where v.id = p_vistoria
      and (p.exige_foto_se->>'modo' = 'SEMPRE'
           or (p.exige_foto_se->>'modo' = 'RESPOSTAS'
               and (p.exige_foto_se->'respostas') ? (r.resposta_json #>> '{}')))
      and not exists (
        select 1 from public.evidencias e
        where e.entidade_tipo = 'VISTORIA' and e.entidade_id = v.id and e.pergunta_id = p.id
          and e.tipo = 'FOTO' and e.status = 'ATIVA')
  ) x
$$;

-- Versão vigente (PUBLICADA) da família de checklist de uma categoria.
create function privado.modelo_vigente(p_empresa uuid, p_familia uuid) returns uuid
language sql stable security definer
set search_path = ''
as $$
  select id from public.modelos_checklist
  where empresa_id = p_empresa and familia_id = p_familia and status = 'PUBLICADO'
$$;

-- ---------------------------------------------- pendências do recebimento ---
create function privado.rotulo_linha_recebimento(p_linha uuid) returns text
language sql stable security definer
set search_path = ''
as $$
  select case when b.id is not null
    then b.codigo || coalesce(' (' || coalesce(b.numero_serie, b.placa, b.identificacao_fornecedor) || ')', '')
    else i.descricao end
  from public.itens_recebimento ir
  join public.itens_locacao i on i.id = ir.item_locacao_id
  left join public.bens b on b.id = ir.bem_id
  where ir.id = p_linha
$$;

create function privado.pendencias_recebimento_interno(p_recebimento uuid) returns text[]
language plpgsql stable security definer
set search_path = ''
as $$
declare
  r public.recebimentos;
  v text[] := '{}';
  l record;
  v_vistoria public.vistorias;
  v_modelo uuid;
  v_pv text[];
begin
  select * into r from public.recebimentos where id = p_recebimento;
  if not exists (select 1 from public.locacoes where id = r.locacao_id and status = 'ATIVA') then
    v := array_append(v, 'A locação não está ativa');
  end if;
  if r.data_evento is null then
    v := array_append(v, 'Informe a data e a hora do recebimento');
  elsif r.data_evento > now() + interval '5 minutes' then
    v := array_append(v, 'A data do recebimento não pode estar no futuro');
  end if;
  if r.local_id is null then
    v := array_append(v, 'Informe o local onde os itens ficarão');
  elsif not exists (select 1 from public.locais where id = r.local_id and ativo) then
    v := array_append(v, 'O local informado está inativo');
  end if;
  if r.responsavel_id is null then
    v := array_append(v, 'Informe o responsável pelos itens');
  elsif not exists (select 1 from public.usuarios_empresa
                    where empresa_id = r.empresa_id and user_id = r.responsavel_id and ativo) then
    v := array_append(v, 'O responsável não está ativo na empresa');
  end if;
  if not exists (select 1 from public.itens_recebimento where recebimento_id = r.id) then
    v := array_append(v, 'Inclua ao menos um item recebido');
  end if;

  for l in
    select ir.id, ir.condicao, ir.bem_id, b.numero_serie, b.placa, b.identificacao_fornecedor,
           c.exige_numero_serie, c.exige_placa, c.exige_ident_fornecedor, c.checklist_familia_id, c.nome categoria,
           privado.rotulo_linha_recebimento(ir.id) rotulo
    from public.itens_recebimento ir
    join public.itens_locacao i on i.id = ir.item_locacao_id
    join public.categorias_bem c on c.id = i.categoria_id
    left join public.bens b on b.id = ir.bem_id
    where ir.recebimento_id = r.id
    order by ir.created_at, ir.id
  loop
    if l.bem_id is not null then
      if l.exige_numero_serie and l.numero_serie is null then
        v := array_append(v, l.rotulo || ': informe o número de série');
      end if;
      if l.exige_placa and l.placa is null then
        v := array_append(v, l.rotulo || ': informe a placa');
      end if;
      if l.exige_ident_fornecedor and l.identificacao_fornecedor is null then
        v := array_append(v, l.rotulo || ': informe a identificação do fornecedor');
      end if;
    end if;
    -- RN-27: avariado exige foto.
    if l.condicao = 'AVARIADO' and not exists (
      select 1 from public.evidencias e
      where e.entidade_tipo = 'ITEM_RECEBIMENTO' and e.entidade_id = l.id and e.tipo = 'FOTO' and e.status = 'ATIVA') then
      v := array_append(v, l.rotulo || ': item avariado exige foto');
    end if;
    if l.checklist_familia_id is not null then
      v_modelo := privado.modelo_vigente(r.empresa_id, l.checklist_familia_id);
      select * into v_vistoria from public.vistorias
      where item_recebimento_id = l.id and status = 'RASCUNHO';
      if v_vistoria.id is null and v_modelo is null then
        v := array_append(v, format('Categoria %s: checklist sem versão publicada', l.categoria));
      elsif v_vistoria.id is null then
        v := array_append(v, l.rotulo || ': faça a vistoria de entrada');
      else
        v_pv := privado.pendencias_vistoria(v_vistoria.id);
        if cardinality(v_pv) > 0 then
          v := array_append(v, l.rotulo || ': vistoria incompleta (' || array_to_string(v_pv, '; ') || ')');
        end if;
      end if;
    end if;
  end loop;
  return v;
end
$$;

create function public.pendencias_recebimento(p_recebimento uuid) returns text[]
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_empresa uuid;
begin
  select empresa_id into v_empresa from public.recebimentos where id = p_recebimento;
  if v_empresa is null or not privado.pode_ler(v_empresa) then
    raise exception 'Recebimento não encontrado' using errcode = 'P0002';
  end if;
  return privado.pendencias_recebimento_interno(p_recebimento);
end
$$;

-- RN-25: quantidade que ultrapassa o contratado, por item.
create function public.excesso_recebimento(p_recebimento uuid)
returns table (item_locacao_id uuid, descricao text, contratada text, ja_recebida text, agora text, excesso text)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_empresa uuid;
begin
  select empresa_id into v_empresa from public.recebimentos where id = p_recebimento;
  if v_empresa is null or not privado.pode_ler(v_empresa) then
    raise exception 'Recebimento não encontrado' using errcode = 'P0002';
  end if;
  return query
    select i.id, i.descricao, i.quantidade_contratada::text, s.quantidade_recebida::text, a.qtd::text,
           (s.quantidade_recebida + a.qtd - i.quantidade_contratada)::text
    from (select ir.item_locacao_id id, sum(ir.quantidade) qtd
          from public.itens_recebimento ir where ir.recebimento_id = p_recebimento
          group by ir.item_locacao_id) a
    join public.itens_locacao i on i.id = a.id
    join lateral (
      -- Mesmo critério de v_saldo_item_locacao, calculado sem a RLS do chamador.
      select case i.modo_controle
        when 'INDIVIDUAL' then (select count(*)::numeric from public.bens b
                                where b.item_locacao_id = i.id and b.substitui_bem_id is null
                                  and b.status not in ('AGUARDANDO_RECEBIMENTO', 'CANCELADO'))
        else (select coalesce(sum(l.quantidade_recebida), 0) from public.lotes l
              where l.item_locacao_id = i.id and l.lote_origem_id is null and l.status <> 'CANCELADO')
      end as quantidade_recebida
    ) s on true
    where s.quantidade_recebida + a.qtd > i.quantidade_contratada
    order by i.descricao;
end
$$;

-- --------------------------------------------- confirmação (transacional) ---
-- Efetiva um recebimento já validado: bens disponíveis, lotes criados,
-- vistorias vinculadas e concluídas, ocorrências automáticas, auditoria.
create function privado.efetivar_recebimento(p_recebimento uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.recebimentos;
  l record;
  v_lote uuid;
  v_fuso text;
  v_uid uuid := (select auth.uid());
  e record;
begin
  select * into r from public.recebimentos where id = p_recebimento;
  select timezone into v_fuso from public.empresas where id = r.empresa_id;

  -- RN-25: excesso autorizado → ocorrência DIVERGENCIA_QUANTIDADE por item.
  -- Calculado ANTES de efetivar bens/lotes (senão o próprio recebimento contaria duas vezes).
  for e in select * from public.excesso_recebimento(r.id) loop
    insert into public.ocorrencias (empresa_id, locacao_id, recebimento_id, tipo, descricao, prioridade,
                                    data_evento, quantidade)
    values (r.empresa_id, r.locacao_id, r.id, 'DIVERGENCIA_QUANTIDADE',
            format('Recebido acima do contratado em %s: %s (contratado %s, já recebido %s). Autorizado: %s',
                   r.codigo, e.descricao, e.contratada, e.ja_recebida, r.excesso_justificativa),
            'MEDIA', r.data_evento, e.excesso::numeric);
  end loop;

  -- Bens individuais: AGUARDANDO_RECEBIMENTO → DISPONIVEL no local/responsável (RN-22, RN-30).
  update public.bens b
     set status = 'DISPONIVEL', local_atual_id = r.local_id, responsavel_atual_id = r.responsavel_id
   where b.recebimento_id = r.id
     and b.status = 'AGUARDANDO_RECEBIMENTO'
     and exists (select 1 from public.itens_recebimento ir where ir.bem_id = b.id and ir.recebimento_id = r.id);

  -- Lotes: um por (recebimento, item) — RN-24.
  for l in select ir.id, ir.item_locacao_id, ir.quantidade from public.itens_recebimento ir
           where ir.recebimento_id = r.id and ir.bem_id is null
  loop
    insert into public.lotes (empresa_id, item_locacao_id, recebimento_id, quantidade_recebida,
                              local_atual_id, responsavel_atual_id)
    values (r.empresa_id, l.item_locacao_id, r.id, l.quantidade, r.local_id, r.responsavel_id)
    returning id into v_lote;
    update public.itens_recebimento set lote_id = v_lote where id = l.id;
  end loop;

  -- Vistorias de entrada: vínculo ao bem/lote e conclusão (RN-83 validado antes).
  update public.vistorias v
     set bem_id = ir.bem_id, lote_id = ir.lote_id, data_evento = r.data_evento
    from public.itens_recebimento ir
   where v.item_recebimento_id = ir.id and ir.recebimento_id = r.id and v.status = 'RASCUNHO';
  update public.vistorias v
     set status = 'CONCLUIDA', concluida_em = now()
    from public.itens_recebimento ir
   where v.item_recebimento_id = ir.id and ir.recebimento_id = r.id and v.status = 'RASCUNHO';

  -- RN-27: avariado → ocorrência AVARIA aberta.
  for l in select ir.id, ir.bem_id, ir.lote_id, ir.observacao, privado.rotulo_linha_recebimento(ir.id) rotulo
           from public.itens_recebimento ir where ir.recebimento_id = r.id and ir.condicao = 'AVARIADO'
  loop
    insert into public.ocorrencias (empresa_id, locacao_id, bem_id, lote_id, recebimento_id, tipo, descricao,
                                    prioridade, data_evento)
    values (r.empresa_id, r.locacao_id, l.bem_id, l.lote_id, r.id, 'AVARIA',
            format('Recebido avariado no recebimento %s: %s.%s', r.codigo, l.rotulo,
                   coalesce(' ' || l.observacao, '')),
            'ALTA', r.data_evento);
  end loop;

  update public.locacoes
     set inicio_efetivo = coalesce(inicio_efetivo, (r.data_evento at time zone v_fuso)::date)
   where id = r.locacao_id and inicio_efetivo is null;

  update public.recebimentos
     set status = 'CONFIRMADO', confirmado_em = now(), confirmado_por = v_uid,
         recebido_por = coalesce(recebido_por, created_by, v_uid)
   where id = r.id;

  perform privado.registrar_auditoria(
    r.empresa_id, 'recebimento.confirmar', 'recebimentos', r.id,
    jsonb_build_object('status', r.status), jsonb_build_object('status', 'CONFIRMADO'),
    jsonb_build_object('locacao_id', r.locacao_id, 'excesso_autorizado', r.excesso_autorizado_por is not null));
end
$$;

-- Retorna o status final: CONFIRMADO, ou AGUARDANDO_AUTORIZACAO se houver excesso.
create function public.rpc_confirmar_recebimento(p_recebimento uuid)
returns public.status_recebimento
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.recebimentos;
  v_pendencias text[];
begin
  select * into r from public.recebimentos where id = p_recebimento for update;
  if not found or not privado.pode_ler(r.empresa_id) then
    raise exception 'Recebimento não encontrado' using errcode = 'P0002';
  end if;
  if not privado.usuario_tem_permissao(r.empresa_id, 'recebimento.registrar') then
    raise exception 'Sem permissão para registrar recebimentos' using errcode = '42501';
  end if;
  if r.status <> 'RASCUNHO' then
    raise exception 'Somente recebimentos em rascunho podem ser confirmados' using errcode = '22023';
  end if;
  perform 1 from public.locacoes where id = r.locacao_id for update;
  v_pendencias := privado.pendencias_recebimento_interno(r.id);
  if cardinality(v_pendencias) > 0 then
    raise exception 'Recebimento incompleto: %', array_to_string(v_pendencias, '; ') using errcode = '22023';
  end if;
  if exists (select 1 from public.excesso_recebimento(r.id)) then
    -- Nunca aceitar excesso silenciosamente (RN-25).
    update public.recebimentos set status = 'AGUARDANDO_AUTORIZACAO' where id = r.id;
    perform privado.registrar_auditoria(
      r.empresa_id, 'recebimento.solicitar_autorizacao', 'recebimentos', r.id,
      jsonb_build_object('status', r.status), jsonb_build_object('status', 'AGUARDANDO_AUTORIZACAO'), null);
    return 'AGUARDANDO_AUTORIZACAO';
  end if;
  perform privado.efetivar_recebimento(r.id);
  return 'CONFIRMADO';
end
$$;

create function public.rpc_autorizar_excesso(p_recebimento uuid, p_justificativa text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.recebimentos;
  v_just text := trim(coalesce(p_justificativa, ''));
  v_pendencias text[];
begin
  select * into r from public.recebimentos where id = p_recebimento for update;
  if not found or not privado.pode_ler(r.empresa_id) then
    raise exception 'Recebimento não encontrado' using errcode = 'P0002';
  end if;
  if not privado.usuario_tem_permissao(r.empresa_id, 'recebimento.autorizar_excesso') then
    raise exception 'Sem permissão para autorizar excesso' using errcode = '42501';
  end if;
  if r.status <> 'AGUARDANDO_AUTORIZACAO' then
    raise exception 'Este recebimento não aguarda autorização' using errcode = '22023';
  end if;
  if length(v_just) < 10 then
    raise exception 'Informe a justificativa com pelo menos 10 caracteres' using errcode = '22023';
  end if;
  perform 1 from public.locacoes where id = r.locacao_id for update;
  -- Revalida: o contexto pode ter mudado desde a solicitação.
  v_pendencias := privado.pendencias_recebimento_interno(r.id);
  if cardinality(v_pendencias) > 0 then
    raise exception 'Recebimento incompleto: %', array_to_string(v_pendencias, '; ') using errcode = '22023';
  end if;
  update public.recebimentos
     set excesso_justificativa = v_just, excesso_autorizado_por = (select auth.uid()), excesso_autorizado_em = now()
   where id = r.id;
  perform privado.registrar_auditoria(
    r.empresa_id, 'recebimento.autorizar_excesso', 'recebimentos', r.id, null, null,
    jsonb_build_object('justificativa', v_just));
  perform privado.efetivar_recebimento(r.id);
end
$$;

-- Devolve ao rascunho para correção (a autorização pendente deixa de valer).
create function public.rpc_reabrir_recebimento(p_recebimento uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.recebimentos;
begin
  select * into r from public.recebimentos where id = p_recebimento for update;
  if not found or not privado.pode_ler(r.empresa_id) then
    raise exception 'Recebimento não encontrado' using errcode = 'P0002';
  end if;
  if not privado.usuario_tem_permissao(r.empresa_id, 'recebimento.registrar') then
    raise exception 'Sem permissão para registrar recebimentos' using errcode = '42501';
  end if;
  if r.status <> 'AGUARDANDO_AUTORIZACAO' then
    raise exception 'Somente recebimentos aguardando autorização podem ser reabertos' using errcode = '22023';
  end if;
  update public.recebimentos set status = 'RASCUNHO' where id = r.id;
  perform privado.registrar_auditoria(
    r.empresa_id, 'recebimento.reabrir', 'recebimentos', r.id,
    jsonb_build_object('status', r.status), jsonb_build_object('status', 'RASCUNHO'), null);
end
$$;

-- RN-28: rascunho/aguardando descartado pelo autor ou ADMIN.
create function public.rpc_descartar_recebimento(p_recebimento uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.recebimentos;
  v_motivo text := trim(coalesce(p_motivo, ''));
  v_uid uuid := (select auth.uid());
begin
  select * into r from public.recebimentos where id = p_recebimento for update;
  if not found or not privado.pode_ler(r.empresa_id) then
    raise exception 'Recebimento não encontrado' using errcode = 'P0002';
  end if;
  if not (privado.usuario_tem_permissao(r.empresa_id, 'recebimento.cancelar_confirmado')
          or (r.created_by = v_uid and privado.usuario_tem_permissao(r.empresa_id, 'recebimento.registrar'))) then
    raise exception 'Somente o autor do rascunho ou um administrador pode descartá-lo' using errcode = '42501';
  end if;
  if r.status not in ('RASCUNHO', 'AGUARDANDO_AUTORIZACAO') then
    raise exception 'Somente rascunhos podem ser descartados' using errcode = '22023';
  end if;
  if length(v_motivo) < 10 then
    raise exception 'Informe o motivo com pelo menos 10 caracteres' using errcode = '22023';
  end if;
  update public.vistorias v set status = 'CANCELADA', cancelada_em = now()
    from public.itens_recebimento ir
   where v.item_recebimento_id = ir.id and ir.recebimento_id = r.id and v.status = 'RASCUNHO';
  update public.bens set status = 'CANCELADO'
   where recebimento_id = r.id and status = 'AGUARDANDO_RECEBIMENTO';
  update public.recebimentos
     set status = 'CANCELADO', cancelado_em = now(), cancelado_por = v_uid, motivo_cancelamento = v_motivo
   where id = r.id;
  perform privado.registrar_auditoria(
    r.empresa_id, 'recebimento.descartar', 'recebimentos', r.id,
    jsonb_build_object('status', r.status), jsonb_build_object('status', 'CANCELADO'),
    jsonb_build_object('motivo', v_motivo));
end
$$;

-- RN-28: cancelamento de recebimento CONFIRMADO (ADMIN), sem eventos posteriores.
create function public.rpc_cancelar_recebimento_confirmado(p_recebimento uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.recebimentos;
  v_motivo text := trim(coalesce(p_motivo, ''));
  v_uid uuid := (select auth.uid());
begin
  select * into r from public.recebimentos where id = p_recebimento for update;
  if not found or not privado.pode_ler(r.empresa_id) then
    raise exception 'Recebimento não encontrado' using errcode = 'P0002';
  end if;
  if not privado.usuario_tem_permissao(r.empresa_id, 'recebimento.cancelar_confirmado') then
    raise exception 'Sem permissão para cancelar recebimento confirmado' using errcode = '42501';
  end if;
  if r.status <> 'CONFIRMADO' then
    raise exception 'Somente recebimentos confirmados' using errcode = '22023';
  end if;
  if length(v_motivo) < 10 then
    raise exception 'Informe o motivo com pelo menos 10 caracteres' using errcode = '22023';
  end if;
  if exists (select 1 from public.bens b where b.recebimento_id = r.id and b.status <> 'DISPONIVEL'
               and b.status <> 'CANCELADO')
     or exists (select 1 from public.lotes l where l.recebimento_id = r.id
                and (l.quantidade_devolvida > 0 or l.quantidade_dividida > 0 or l.quantidade_baixada > 0))
     or exists (select 1 from public.movimentacoes m
                where m.bem_id in (select id from public.bens where recebimento_id = r.id)
                   or m.lote_id in (select id from public.lotes where recebimento_id = r.id))
     or exists (select 1 from public.vistorias v
                where (v.bem_id in (select id from public.bens where recebimento_id = r.id)
                       or v.lote_id in (select id from public.lotes where recebimento_id = r.id))
                  and v.item_recebimento_id is null)
     or exists (select 1 from public.itens_devolucao d
                where d.bem_id in (select id from public.bens where recebimento_id = r.id)
                   or d.lote_id in (select id from public.lotes where recebimento_id = r.id))
     or exists (select 1 from public.ocorrencias o
                where (o.recebimento_id is distinct from r.id)
                  and (o.bem_id in (select id from public.bens where recebimento_id = r.id)
                       or o.lote_id in (select id from public.lotes where recebimento_id = r.id))) then
    raise exception 'Há eventos posteriores (movimentação, vistoria, devolução ou ocorrência) nos itens deste recebimento'
      using errcode = '22023';
  end if;
  update public.bens set status = 'CANCELADO' where recebimento_id = r.id and status = 'DISPONIVEL';
  update public.lotes set status = 'CANCELADO' where recebimento_id = r.id and status = 'ATIVO';
  update public.ocorrencias set status = 'CANCELADA', cancelada_em = now(), cancelada_por = v_uid,
         motivo_cancelamento = 'Recebimento cancelado: ' || v_motivo
   where recebimento_id = r.id and status in ('ABERTA', 'EM_TRATAMENTO');
  update public.recebimentos
     set status = 'CANCELADO', cancelado_em = now(), cancelado_por = v_uid, motivo_cancelamento = v_motivo
   where id = r.id;
  perform privado.registrar_auditoria(
    r.empresa_id, 'recebimento.cancelar_confirmado', 'recebimentos', r.id,
    jsonb_build_object('status', r.status), jsonb_build_object('status', 'CANCELADO'),
    jsonb_build_object('motivo', v_motivo));
end
$$;

-- --------------------------------------------------- linhas do rascunho -----
create function privado.recebimento_editavel(p_recebimento uuid) returns public.recebimentos
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.recebimentos;
begin
  select * into r from public.recebimentos where id = p_recebimento for update;
  if not found or not privado.pode_ler(r.empresa_id) then
    raise exception 'Recebimento não encontrado' using errcode = 'P0002';
  end if;
  if not privado.usuario_tem_permissao(r.empresa_id, 'recebimento.registrar') then
    raise exception 'Sem permissão para registrar recebimentos' using errcode = '42501';
  end if;
  if r.status <> 'RASCUNHO' then
    raise exception 'Recebimento fora do rascunho não pode ser alterado' using errcode = '22023';
  end if;
  return r;
end
$$;

-- Item INDIVIDUAL: cria o bem (aguardando) e a linha numa única transação.
create function public.rpc_adicionar_bem_recebimento(
  p_recebimento uuid,
  p_item_locacao uuid,
  p_numero_serie text default null,
  p_placa text default null,
  p_identificacao_fornecedor text default null,
  p_condicao public.condicao_item default 'BOM',
  p_observacao text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.recebimentos;
  v_bem uuid;
begin
  r := privado.recebimento_editavel(p_recebimento);
  if not exists (select 1 from public.itens_locacao i where i.id = p_item_locacao
                 and i.locacao_id = r.locacao_id and i.modo_controle = 'INDIVIDUAL') then
    raise exception 'Item individual não pertence a esta locação' using errcode = '22023';
  end if;
  insert into public.bens (empresa_id, item_locacao_id, recebimento_id, numero_serie, placa, identificacao_fornecedor)
  values (r.empresa_id, p_item_locacao, r.id, nullif(trim(p_numero_serie), ''), nullif(trim(p_placa), ''),
          nullif(trim(p_identificacao_fornecedor), ''))
  returning id into v_bem;
  insert into public.itens_recebimento (empresa_id, recebimento_id, item_locacao_id, bem_id, quantidade, condicao, observacao)
  values (r.empresa_id, r.id, p_item_locacao, v_bem, 1, p_condicao, nullif(trim(p_observacao), ''));
  return v_bem;
end
$$;

-- Item LOTE: define (ou remove, com quantidade 0) a quantidade da linha.
create function public.rpc_definir_lote_recebimento(
  p_recebimento uuid,
  p_item_locacao uuid,
  p_quantidade numeric,
  p_condicao public.condicao_item default 'BOM',
  p_observacao text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.recebimentos;
  v_linha uuid;
begin
  r := privado.recebimento_editavel(p_recebimento);
  if not exists (select 1 from public.itens_locacao i where i.id = p_item_locacao
                 and i.locacao_id = r.locacao_id and i.modo_controle = 'LOTE') then
    raise exception 'Item de lote não pertence a esta locação' using errcode = '22023';
  end if;
  if p_quantidade is null or p_quantidade < 0 or p_quantidade <> round(p_quantidade, 3) then
    raise exception 'Quantidade inválida' using errcode = '22023';
  end if;
  select id into v_linha from public.itens_recebimento
  where recebimento_id = r.id and item_locacao_id = p_item_locacao and bem_id is null;
  if p_quantidade = 0 then
    if v_linha is not null then
      perform privado.remover_linha(v_linha);
    end if;
    return;
  end if;
  if v_linha is null then
    insert into public.itens_recebimento (empresa_id, recebimento_id, item_locacao_id, quantidade, condicao, observacao)
    values (r.empresa_id, r.id, p_item_locacao, p_quantidade, p_condicao, nullif(trim(p_observacao), ''));
  else
    update public.itens_recebimento
       set quantidade = p_quantidade, condicao = p_condicao, observacao = nullif(trim(p_observacao), '')
     where id = v_linha;
  end if;
end
$$;

-- Remove a linha do rascunho: vistoria cancelada, bem cancelado (nunca recebido).
create function privado.remover_linha(p_linha uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bem uuid;
begin
  select bem_id into v_bem from public.itens_recebimento where id = p_linha;
  -- A vistoria em rascunho é cancelada e desvinculada da linha (fica no histórico
  -- ligada ao recebimento por evento_origem_id; fotos continuam preservadas).
  update public.vistorias
     set status = 'CANCELADA', cancelada_em = now(), item_recebimento_id = null, bem_id = v_bem
   where item_recebimento_id = p_linha and status = 'RASCUNHO';
  delete from public.itens_recebimento where id = p_linha;
  if v_bem is not null then
    update public.bens set status = 'CANCELADO' where id = v_bem and status = 'AGUARDANDO_RECEBIMENTO';
  end if;
end
$$;

create function public.rpc_remover_linha_recebimento(p_linha uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recebimento uuid;
begin
  select recebimento_id into v_recebimento from public.itens_recebimento where id = p_linha;
  if v_recebimento is null then
    raise exception 'Linha não encontrada' using errcode = 'P0002';
  end if;
  perform privado.recebimento_editavel(v_recebimento);
  perform privado.remover_linha(p_linha);
end
$$;

-- ------------------------------------------------ vistoria de entrada -------
-- Cria (ou devolve a existente) a vistoria da linha com a versão VIGENTE do
-- checklist da categoria — congelada na vistoria (RN-81).
create function public.rpc_iniciar_vistoria_entrada(p_linha uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ir public.itens_recebimento;
  r public.recebimentos;
  v_familia uuid;
  v_modelo uuid;
  v_id uuid;
begin
  select * into ir from public.itens_recebimento where id = p_linha;
  if not found then
    raise exception 'Linha não encontrada' using errcode = 'P0002';
  end if;
  r := privado.recebimento_editavel(ir.recebimento_id);
  if not privado.usuario_tem_permissao(r.empresa_id, 'vistoria.registrar') then
    raise exception 'Sem permissão para registrar vistorias' using errcode = '42501';
  end if;
  select id into v_id from public.vistorias where item_recebimento_id = p_linha and status = 'RASCUNHO';
  if v_id is not null then
    return v_id;
  end if;
  select c.checklist_familia_id into v_familia
  from public.itens_locacao i join public.categorias_bem c on c.id = i.categoria_id
  where i.id = ir.item_locacao_id;
  if v_familia is null then
    raise exception 'A categoria deste item não tem checklist' using errcode = '22023';
  end if;
  v_modelo := privado.modelo_vigente(r.empresa_id, v_familia);
  if v_modelo is null then
    raise exception 'O checklist da categoria não tem versão publicada' using errcode = '22023';
  end if;
  insert into public.vistorias (empresa_id, tipo, modelo_id, item_recebimento_id, evento_origem_tipo,
                                evento_origem_id, data_evento)
  values (r.empresa_id, 'ENTRADA', v_modelo, p_linha, 'RECEBIMENTO', r.id, coalesce(r.data_evento, now()))
  returning id into v_id;
  return v_id;
end
$$;

-- Grava as respostas de uma vistoria em rascunho numa única transação:
-- {pergunta_id: valor} — valor null remove a resposta. Tipos validados por trigger.
create function public.rpc_salvar_respostas_vistoria(p_vistoria uuid, p_respostas jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.vistorias;
  r record;
begin
  select * into v from public.vistorias where id = p_vistoria for update;
  if not found or not privado.usuario_pertence_empresa(v.empresa_id)
     or not (privado.pode_ler(v.empresa_id) or privado.ve_bem(v.bem_id) or privado.ve_lote(v.lote_id)) then
    raise exception 'Vistoria não encontrada' using errcode = 'P0002';
  end if;
  if not privado.usuario_tem_permissao(v.empresa_id, 'vistoria.registrar') then
    raise exception 'Sem permissão para registrar vistorias' using errcode = '42501';
  end if;
  if v.status <> 'RASCUNHO' then
    raise exception 'Vistoria concluída não pode ser alterada' using errcode = '22023';
  end if;
  if jsonb_typeof(p_respostas) <> 'object' then
    raise exception 'Respostas inválidas' using errcode = '22023';
  end if;
  for r in select key::uuid as pergunta, value from jsonb_each(p_respostas) loop
    if not exists (select 1 from public.perguntas_checklist p where p.id = r.pergunta and p.modelo_id = v.modelo_id) then
      raise exception 'Pergunta não pertence ao checklist da vistoria' using errcode = '22023';
    end if;
    if jsonb_typeof(r.value) = 'null' then
      delete from public.respostas_vistoria where vistoria_id = v.id and pergunta_id = r.pergunta;
    else
      insert into public.respostas_vistoria (empresa_id, vistoria_id, pergunta_id, resposta_json)
      values (v.empresa_id, v.id, r.pergunta, r.value)
      on conflict (vistoria_id, pergunta_id)
      do update set resposta_json = excluded.resposta_json
      where public.respostas_vistoria.resposta_json is distinct from excluded.resposta_json;
    end if;
  end loop;
end
$$;

-- ------------------------------------------------------------- evidências ---
-- Regras de anexação (RN-92): permissão, mesma empresa, acesso à entidade e
-- entidade ainda aberta quando o anexo faz parte de um registro em edição.
create function privado.validar_anexo(
  p_entidade_tipo public.entidade_evidencia,
  p_entidade_id uuid,
  p_tipo public.tipo_evidencia,
  p_pergunta uuid
) returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_empresa uuid;
  v_tabela text;
begin
  v_tabela := case p_entidade_tipo
    when 'LOCACAO' then 'locacoes' when 'RECEBIMENTO' then 'recebimentos'
    when 'ITEM_RECEBIMENTO' then 'itens_recebimento' when 'BEM' then 'bens' when 'LOTE' then 'lotes'
    when 'VISTORIA' then 'vistorias' when 'RESPOSTA_VISTORIA' then 'respostas_vistoria'
    when 'MOVIMENTACAO' then 'movimentacoes' when 'OCORRENCIA' then 'ocorrencias'
    when 'DEVOLUCAO' then 'devolucoes' when 'COBRANCA' then 'cobrancas' end;
  execute format('select empresa_id from public.%I where id = $1', v_tabela) into v_empresa using p_entidade_id;
  if v_empresa is null or not privado.usuario_pertence_empresa(v_empresa)
     or not (privado.pode_ler(v_empresa) or privado.ve_entidade(p_entidade_tipo, p_entidade_id)) then
    raise exception 'Registro não encontrado' using errcode = 'P0002';
  end if;
  if not privado.usuario_tem_permissao(v_empresa, 'evidencia.enviar') then
    raise exception 'Sem permissão para enviar evidências' using errcode = '42501';
  end if;
  if p_tipo = 'CONTRATO' and p_entidade_tipo <> 'LOCACAO' then
    raise exception 'Contrato só pode ser anexado à locação' using errcode = '22023';
  end if;
  if p_pergunta is not null and p_entidade_tipo <> 'VISTORIA' then
    raise exception 'Pergunta só se aplica a fotos de vistoria' using errcode = '22023';
  end if;
  if p_entidade_tipo = 'VISTORIA' then
    if not exists (select 1 from public.vistorias where id = p_entidade_id and status = 'RASCUNHO') then
      raise exception 'Vistoria concluída não aceita novos anexos' using errcode = '22023';
    end if;
    if p_pergunta is not null and not exists (
      select 1 from public.perguntas_checklist p join public.vistorias v on v.modelo_id = p.modelo_id
      where v.id = p_entidade_id and p.id = p_pergunta) then
      raise exception 'Pergunta não pertence ao checklist da vistoria' using errcode = '22023';
    end if;
  elsif p_entidade_tipo = 'ITEM_RECEBIMENTO' then
    if not exists (select 1 from public.itens_recebimento ir join public.recebimentos r on r.id = ir.recebimento_id
                   where ir.id = p_entidade_id and r.status = 'RASCUNHO') then
      raise exception 'Recebimento fora do rascunho não aceita novos anexos nos itens' using errcode = '22023';
    end if;
  end if;
  return v_empresa;
end
$$;

-- Pré-verificação ANTES do upload (o servidor não grava arquivo sem autorização).
create function public.rpc_preparar_evidencia(
  p_entidade_tipo public.entidade_evidencia,
  p_entidade_id uuid,
  p_tipo public.tipo_evidencia,
  p_pergunta uuid default null
) returns table (empresa_id uuid, limite_imagem_bytes bigint, limite_pdf_bytes bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_empresa uuid := privado.validar_anexo(p_entidade_tipo, p_entidade_id, p_tipo, p_pergunta);
begin
  return query
    select e.id, e.limite_upload_imagem_mb::bigint * 1048576, e.limite_upload_pdf_mb::bigint * 1048576
    from public.empresas e where e.id = v_empresa;
end
$$;

create function privado.inserir_evidencia(
  p_entidade_tipo public.entidade_evidencia, p_entidade_id uuid, p_tipo public.tipo_evidencia,
  p_storage_path text, p_nome_original text, p_mime_type text, p_tamanho_bytes bigint, p_hash text,
  p_capturada_em timestamptz, p_latitude numeric, p_longitude numeric, p_legenda text, p_pergunta uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa uuid := privado.validar_anexo(p_entidade_tipo, p_entidade_id, p_tipo, p_pergunta);
  v_limite bigint;
  v_id uuid;
begin
  select case when p_mime_type = 'application/pdf' then limite_upload_pdf_mb else limite_upload_imagem_mb end
         ::bigint * 1048576 into v_limite
  from public.empresas where id = v_empresa;
  if p_tamanho_bytes > v_limite then
    raise exception 'Arquivo acima do limite da empresa' using errcode = '22023';
  end if;
  if split_part(p_storage_path, '/', 1) <> v_empresa::text then
    raise exception 'Caminho do arquivo inválido' using errcode = '22023';
  end if;
  insert into public.evidencias (empresa_id, entidade_tipo, entidade_id, tipo, bucket, storage_path, nome_original,
    mime_type, tamanho_bytes, hash_arquivo, capturada_em, latitude, longitude, legenda, pergunta_id)
  values (v_empresa, p_entidade_tipo, p_entidade_id, p_tipo,
          case p_tipo when 'CONTRATO' then 'contratos' when 'COMPROVANTE' then 'comprovantes' else 'evidencias' end,
          p_storage_path, nullif(trim(p_nome_original), ''), p_mime_type, p_tamanho_bytes, p_hash,
          p_capturada_em, p_latitude, p_longitude, nullif(trim(p_legenda), ''), p_pergunta)
  returning id into v_id;
  perform privado.registrar_auditoria(
    v_empresa, 'evidencia.enviar', 'evidencias', v_id, null,
    jsonb_build_object('entidade_tipo', p_entidade_tipo, 'entidade_id', p_entidade_id, 'tipo', p_tipo,
                       'hash', p_hash, 'tamanho', p_tamanho_bytes), null);
  return v_id;
end
$$;

create function public.rpc_registrar_evidencia(
  p_entidade_tipo public.entidade_evidencia,
  p_entidade_id uuid,
  p_tipo public.tipo_evidencia,
  p_storage_path text,
  p_mime_type text,
  p_tamanho_bytes bigint,
  p_hash text,
  p_nome_original text default null,
  p_capturada_em timestamptz default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_legenda text default null,
  p_pergunta uuid default null
) returns uuid
language sql
security definer
set search_path = ''
as $$
  select privado.inserir_evidencia(p_entidade_tipo, p_entidade_id, p_tipo, p_storage_path, p_nome_original,
    p_mime_type, p_tamanho_bytes, p_hash, p_capturada_em, p_latitude, p_longitude, p_legenda, p_pergunta)
$$;

-- RN-95: substituição — a nova evidência entra e a antiga aponta para ela.
create function public.rpc_substituir_evidencia(
  p_antiga uuid,
  p_storage_path text,
  p_mime_type text,
  p_tamanho_bytes bigint,
  p_hash text,
  p_nome_original text default null,
  p_capturada_em timestamptz default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_legenda text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.evidencias;
  v_nova uuid;
begin
  select * into a from public.evidencias where id = p_antiga for update;
  if not found or not privado.usuario_pertence_empresa(a.empresa_id)
     or not (privado.pode_ler(a.empresa_id) or privado.ve_entidade(a.entidade_tipo, a.entidade_id)) then
    raise exception 'Evidência não encontrada' using errcode = 'P0002';
  end if;
  if not privado.usuario_tem_permissao(a.empresa_id, 'evidencia.substituir_remover') then
    raise exception 'Sem permissão para substituir evidências' using errcode = '42501';
  end if;
  if a.status <> 'ATIVA' then
    raise exception 'Somente evidências ativas podem ser substituídas' using errcode = '22023';
  end if;
  v_nova := privado.inserir_evidencia(a.entidade_tipo, a.entidade_id, a.tipo, p_storage_path, p_nome_original,
    p_mime_type, p_tamanho_bytes, p_hash, p_capturada_em, p_latitude, p_longitude, p_legenda, a.pergunta_id);
  update public.evidencias set status = 'SUBSTITUIDA', substituida_por_id = v_nova where id = a.id;
  perform privado.registrar_auditoria(
    a.empresa_id, 'evidencia.substituir', 'evidencias', a.id, jsonb_build_object('status', a.status),
    jsonb_build_object('status', 'SUBSTITUIDA', 'substituida_por_id', v_nova), null);
  return v_nova;
end
$$;

create function public.rpc_remover_evidencia(p_evidencia uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.evidencias;
  v_motivo text := trim(coalesce(p_motivo, ''));
begin
  select * into a from public.evidencias where id = p_evidencia for update;
  if not found or not privado.usuario_pertence_empresa(a.empresa_id)
     or not (privado.pode_ler(a.empresa_id) or privado.ve_entidade(a.entidade_tipo, a.entidade_id)) then
    raise exception 'Evidência não encontrada' using errcode = 'P0002';
  end if;
  if not privado.usuario_tem_permissao(a.empresa_id, 'evidencia.substituir_remover') then
    raise exception 'Sem permissão para remover evidências' using errcode = '42501';
  end if;
  if a.status <> 'ATIVA' then
    raise exception 'Somente evidências ativas podem ser removidas' using errcode = '22023';
  end if;
  if length(v_motivo) < 10 then
    raise exception 'Informe o motivo com pelo menos 10 caracteres' using errcode = '22023';
  end if;
  update public.evidencias
     set status = 'REMOVIDA', removida_em = now(), removida_por = (select auth.uid()), motivo_remocao = v_motivo
   where id = a.id;
  perform privado.registrar_auditoria(
    a.empresa_id, 'evidencia.remover', 'evidencias', a.id, jsonb_build_object('status', a.status),
    jsonb_build_object('status', 'REMOVIDA'), jsonb_build_object('motivo', v_motivo));
end
$$;

-- ---------------------------------------------------------------- grants ----
revoke all on function
  privado.validar_resposta_vistoria(), privado.pendencias_vistoria(uuid), privado.modelo_vigente(uuid, uuid),
  privado.rotulo_linha_recebimento(uuid), privado.pendencias_recebimento_interno(uuid),
  privado.efetivar_recebimento(uuid), privado.recebimento_editavel(uuid), privado.remover_linha(uuid),
  privado.validar_anexo(public.entidade_evidencia, uuid, public.tipo_evidencia, uuid),
  privado.inserir_evidencia(public.entidade_evidencia, uuid, public.tipo_evidencia, text, text, text, bigint, text,
                            timestamptz, numeric, numeric, text, uuid)
from public, anon, authenticated;

revoke all on function
  public.pendencias_recebimento(uuid),
  public.excesso_recebimento(uuid),
  public.rpc_confirmar_recebimento(uuid),
  public.rpc_autorizar_excesso(uuid, text),
  public.rpc_reabrir_recebimento(uuid),
  public.rpc_descartar_recebimento(uuid, text),
  public.rpc_cancelar_recebimento_confirmado(uuid, text),
  public.rpc_adicionar_bem_recebimento(uuid, uuid, text, text, text, public.condicao_item, text),
  public.rpc_definir_lote_recebimento(uuid, uuid, numeric, public.condicao_item, text),
  public.rpc_remover_linha_recebimento(uuid),
  public.rpc_iniciar_vistoria_entrada(uuid),
  public.rpc_salvar_respostas_vistoria(uuid, jsonb),
  public.rpc_preparar_evidencia(public.entidade_evidencia, uuid, public.tipo_evidencia, uuid),
  public.rpc_registrar_evidencia(public.entidade_evidencia, uuid, public.tipo_evidencia, text, text, bigint, text,
                                 text, timestamptz, numeric, numeric, text, uuid),
  public.rpc_substituir_evidencia(uuid, text, text, bigint, text, text, timestamptz, numeric, numeric, text),
  public.rpc_remover_evidencia(uuid, text)
from public, anon;

grant execute on function
  public.pendencias_recebimento(uuid),
  public.excesso_recebimento(uuid),
  public.rpc_confirmar_recebimento(uuid),
  public.rpc_autorizar_excesso(uuid, text),
  public.rpc_reabrir_recebimento(uuid),
  public.rpc_descartar_recebimento(uuid, text),
  public.rpc_cancelar_recebimento_confirmado(uuid, text),
  public.rpc_adicionar_bem_recebimento(uuid, uuid, text, text, text, public.condicao_item, text),
  public.rpc_definir_lote_recebimento(uuid, uuid, numeric, public.condicao_item, text),
  public.rpc_remover_linha_recebimento(uuid),
  public.rpc_iniciar_vistoria_entrada(uuid),
  public.rpc_salvar_respostas_vistoria(uuid, jsonb),
  public.rpc_preparar_evidencia(public.entidade_evidencia, uuid, public.tipo_evidencia, uuid),
  public.rpc_registrar_evidencia(public.entidade_evidencia, uuid, public.tipo_evidencia, text, text, bigint, text,
                                 text, timestamptz, numeric, numeric, text, uuid),
  public.rpc_substituir_evidencia(uuid, text, text, bigint, text, text, timestamptz, numeric, numeric, text),
  public.rpc_remover_evidencia(uuid, text)
to authenticated;
