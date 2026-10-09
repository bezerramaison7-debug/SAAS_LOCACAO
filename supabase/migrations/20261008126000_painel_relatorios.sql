-- =============================================================================
-- 016 — Fase 8: filtros do painel (término entre hoje e N dias, vencidos com
--        saldo, situação financeira) e relatórios PDF assíncronos (pedido,
--        fila com reivindicação, snapshot consistente, conclusão e falha).
-- Snapshot e fila só para o service_role (worker); pedido e leitura pelo
-- usuário com RLS (D-16, RN-110..112).
-- =============================================================================

-- ------------------------------------------------------ busca de locações ---
drop function public.buscar_locacoes(uuid, text, public.status_locacao[], uuid, uuid, uuid, date, date, date, integer, integer);
create function public.buscar_locacoes(
  p_empresa uuid,
  p_q text default null,
  p_status public.status_locacao[] default null,
  p_fornecedor uuid default null,
  p_centro_custo uuid default null,
  p_local uuid default null,
  p_periodo_inicio date default null,
  p_periodo_fim date default null,
  p_termino_ate date default null,
  p_limite integer default 25,
  p_offset integer default 0,
  p_termino_de date default null,
  p_com_saldo boolean default false,
  p_status_financeiro public.status_financeiro[] default null
) returns table (
  id uuid,
  codigo text,
  status public.status_locacao,
  status_financeiro public.status_financeiro,
  fornecedor text,
  centro_custo text,
  pedidos_sectra text,
  inicio_previsto date,
  termino_previsto date,
  created_at timestamptz,
  total bigint
)
language sql stable
set search_path = ''
as $$
  with termo as (
    select nullif(trim(p_q), '') as q
  ),
  filtradas as (
    select l.*
    from public.locacoes l, termo t
    where l.empresa_id = p_empresa
      and (p_status is null or l.status = any (p_status))
      and (p_fornecedor is null or l.fornecedor_id = p_fornecedor)
      and (p_centro_custo is null or l.centro_custo_id = p_centro_custo)
      and (p_termino_ate is null or l.termino_previsto <= p_termino_ate)
      and (p_termino_de is null or l.termino_previsto >= p_termino_de)
      and (p_status_financeiro is null or l.status_financeiro = any (p_status_financeiro))
      -- "Término vencido" só conta locação que ainda tem saldo (§5.2).
      and (not p_com_saldo or exists (
            select 1 from public.itens_locacao i
            where i.locacao_id = l.id
              and (exists (select 1 from public.bens b where b.item_locacao_id = i.id and public.status_bem_ativo(b.status))
                   or exists (select 1 from public.lotes lt where lt.item_locacao_id = i.id and lt.status = 'ATIVO'))))
      -- período: vigência prevista intersecta o intervalo
      and (p_periodo_inicio is null or coalesce(l.termino_previsto, 'infinity'::date) >= p_periodo_inicio)
      and (p_periodo_fim is null or coalesce(l.inicio_previsto, '-infinity'::date) <= p_periodo_fim)
      and (p_local is null or exists (
            select 1 from public.itens_locacao i
            where i.locacao_id = l.id
              and (exists (select 1 from public.bens b where b.item_locacao_id = i.id and b.local_atual_id = p_local
                           and public.status_bem_ativo(b.status))
                   or exists (select 1 from public.lotes lt where lt.item_locacao_id = i.id
                              and lt.local_atual_id = p_local and lt.status = 'ATIVO'))))
      and (t.q is null
           or l.codigo ilike '%' || t.q || '%'
           or exists (select 1 from public.referencias_externas r
                      where r.locacao_id = l.id and r.numero ilike '%' || t.q || '%')
           or exists (select 1 from public.fornecedores f
                      where f.id = l.fornecedor_id
                        and (f.razao_social ilike '%' || t.q || '%' or f.nome_fantasia ilike '%' || t.q || '%'
                             or f.documento ilike '%' || t.q || '%'))
           or exists (select 1 from public.itens_locacao i join public.bens b on b.item_locacao_id = i.id
                      where i.locacao_id = l.id
                        and (b.codigo ilike '%' || t.q || '%' or b.numero_serie ilike '%' || t.q || '%'
                             or b.placa ilike '%' || t.q || '%' or b.identificacao_fornecedor ilike '%' || t.q || '%'))
           or exists (select 1 from public.itens_locacao i join public.lotes lt on lt.item_locacao_id = i.id
                      where i.locacao_id = l.id and lt.codigo ilike '%' || t.q || '%'))
  )
  select
    f.id, f.codigo, f.status, f.status_financeiro,
    coalesce(fo.nome_fantasia, fo.razao_social),
    cc.codigo || ' · ' || cc.nome,
    (select string_agg(r.numero, ', ' order by r.numero) from public.referencias_externas r
      where r.locacao_id = f.id and r.sistema = 'SECTRA' and r.tipo = 'PEDIDO'),
    f.inicio_previsto, f.termino_previsto, f.created_at,
    count(*) over ()
  from filtradas f
  left join public.fornecedores fo on fo.id = f.fornecedor_id
  left join public.centros_custo cc on cc.id = f.centro_custo_id
  order by f.created_at desc, f.codigo desc
  limit least(greatest(p_limite, 1), 100)
  offset greatest(p_offset, 0)
$$;

revoke all on function public.buscar_locacoes(uuid, text, public.status_locacao[], uuid, uuid, uuid, date, date, date,
  integer, integer, date, boolean, public.status_financeiro[]) from public, anon;
grant execute on function public.buscar_locacoes(uuid, text, public.status_locacao[], uuid, uuid, uuid, date, date, date,
  integer, integer, date, boolean, public.status_financeiro[]) to authenticated;

-- ------------------------------------------------------------- relatórios ---
create function privado.nome_usuario(p_usuario uuid) returns text
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select nome from public.perfis_usuario where user_id = p_usuario), 'Usuário')
$$;

-- Pedido (RN-111): valida alvo e permissão, aplica limite de taxa e enfileira.
-- `incluir_valores` é decidido aqui, pelo papel de quem pede (nunca pelo cliente).
create function public.rpc_solicitar_relatorio(
  p_tipo public.tipo_relatorio,
  p_alvo uuid default null,
  p_inicio date default null,
  p_fim date default null,
  p_versao_template text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa uuid;
  v_parametros jsonb;
  v_id uuid;
begin
  if p_tipo = 'PERIODO' then
    if p_inicio is null or p_fim is null or p_fim < p_inicio or p_fim - p_inicio > 366 then
      raise exception 'Período inválido (até 1 ano)' using errcode = '22023';
    end if;
  end if;
  v_empresa := case p_tipo
    when 'LOCACAO' then (select empresa_id from public.locacoes where id = p_alvo and status <> 'RASCUNHO')
    when 'BEM' then (select empresa_id from public.bens where id = p_alvo
                       and status not in ('AGUARDANDO_RECEBIMENTO', 'CANCELADO'))
    when 'LOCAL' then (select empresa_id from public.locais where id = p_alvo)
    -- Período: o alvo é a própria empresa (escolhida pelo servidor a partir do contexto).
    when 'PERIODO' then (select id from public.empresas where id = p_alvo)
  end;
  if v_empresa is null or not privado.pode_ler(v_empresa) then
    raise exception 'Registro não encontrado' using errcode = 'P0002';
  end if;
  if not privado.usuario_tem_permissao(v_empresa, 'relatorio.gerar') then
    raise exception 'Sem permissão para gerar relatórios' using errcode = '42501';
  end if;
  if coalesce(trim(p_versao_template), '') !~ '^[a-z0-9.-]{1,40}$' then
    raise exception 'Versão de template inválida' using errcode = '22023';
  end if;
  if not public.consumir_limite_taxa('relatorio.gerar') then
    raise exception 'Muitos relatórios pedidos em pouco tempo. Aguarde alguns minutos.' using errcode = '22023';
  end if;
  v_parametros := jsonb_build_object(
    'alvo', p_alvo,
    'incluir_valores', privado.usuario_tem_permissao(v_empresa, 'valores.ver'))
    || case when p_tipo = 'PERIODO' then jsonb_build_object('inicio', p_inicio, 'fim', p_fim) else '{}' end;
  insert into public.relatorios (empresa_id, codigo, tipo, parametros, solicitado_por, versao_template)
  values (v_empresa, '', p_tipo, v_parametros, (select auth.uid()), p_versao_template)
  returning id into v_id;
  perform privado.registrar_auditoria(v_empresa, 'relatorio.solicitar', 'relatorios', v_id, null,
    jsonb_build_object('tipo', p_tipo, 'parametros', v_parametros), null);
  return v_id;
end
$$;

-- Fila (worker com service_role): watchdog + nova tentativa + reivindicação
-- de UM job por chamada (for update skip locked).
create function public.relatorio_reivindicar()
returns public.relatorios
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.relatorios;
begin
  -- Watchdog: PROCESSANDO há mais de 10 minutos vira ERRO (RN-111/§4.11).
  update public.relatorios set status = 'ERRO', erro = 'Tempo de processamento esgotado'
   where status = 'PROCESSANDO' and iniciado_em < now() - interval '10 minutes';
  -- Nova tentativa automática (máx. 3).
  update public.relatorios set status = 'PENDENTE', erro = null
   where status = 'ERRO' and tentativas < 3 and updated_at < now() - interval '30 seconds';
  select * into r from public.relatorios
   where status = 'PENDENTE' order by created_at
   for update skip locked limit 1;
  if not found then
    return null;
  end if;
  update public.relatorios
     set status = 'PROCESSANDO', iniciado_em = now(), tentativas = tentativas + 1
   where id = r.id
  returning * into r;
  return r;
end
$$;

create function public.relatorio_concluir(
  p_relatorio uuid, p_storage_path text, p_hash_arquivo text, p_hash_dados text, p_assinatura text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.relatorios;
begin
  select * into r from public.relatorios where id = p_relatorio for update;
  if not found or r.status <> 'PROCESSANDO' then
    raise exception 'Relatório não está em processamento' using errcode = '22023';
  end if;
  update public.relatorios
     set status = 'CONCLUIDO', storage_path = p_storage_path, hash_arquivo = p_hash_arquivo,
         hash_dados = p_hash_dados, assinatura_hmac = p_assinatura, concluido_em = now(), erro = null
   where id = r.id;
  -- Ator: quem pediu (o worker não tem sessão de usuário).
  insert into public.auditoria (empresa_id, ator_id, acao, entidade_tipo, entidade_id, dados_anteriores, dados_novos)
  values (r.empresa_id, r.solicitado_por, 'relatorio.gerar', 'relatorios', r.id,
          jsonb_build_object('status', 'PROCESSANDO'),
          jsonb_build_object('status', 'CONCLUIDO', 'hash_dados', p_hash_dados, 'hash_arquivo', p_hash_arquivo));
end
$$;

create function public.relatorio_falhar(p_relatorio uuid, p_erro text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.relatorios set status = 'ERRO', erro = left(coalesce(nullif(trim(p_erro), ''), 'Falha'), 2000)
   where id = p_relatorio and status = 'PROCESSANDO'
$$;

-- Seções do relatório para um conjunto de bens/lotes (null = todos da empresa)
-- e, opcionalmente, um intervalo de datas dos eventos. Leitura única e
-- consistente (a função roda numa só instrução/snapshot).
create function privado.relatorio_secoes(
  p_empresa uuid,
  p_bens uuid[],
  p_lotes uuid[],
  p_de timestamptz,
  p_ate timestamptz,
  p_fichas boolean,
  p_fotos boolean,
  p_limite_fotos integer
) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with
  bs as (
    select b.* from public.bens b
    where b.empresa_id = p_empresa and b.status not in ('AGUARDANDO_RECEBIMENTO', 'CANCELADO')
      and (p_bens is null or b.id = any (p_bens))
  ),
  ls as (
    select l.* from public.lotes l
    where l.empresa_id = p_empresa and l.status <> 'CANCELADO'
      and (p_lotes is null or l.id = any (p_lotes))
  ),
  no_periodo as (
    select p_de as de, p_ate as ate
  ),
  vist as (
    select v.* from public.vistorias v, no_periodo np
    where v.empresa_id = p_empresa and v.status <> 'CANCELADA'
      and (v.bem_id in (select id from bs) or v.lote_id in (select id from ls))
      and (np.de is null or v.data_evento between np.de and np.ate)
  ),
  movs as (
    select m.* from public.movimentacoes m, no_periodo np
    where m.empresa_id = p_empresa
      and (m.bem_id in (select id from bs) or m.lote_id in (select id from ls) or m.lote_destino_id in (select id from ls))
      and (np.de is null or m.data_evento between np.de and np.ate)
  ),
  ocors as (
    select o.* from public.ocorrencias o, no_periodo np
    where o.empresa_id = p_empresa
      and (o.bem_id in (select id from bs) or o.lote_id in (select id from ls) or o.bem_substituto_id in (select id from bs))
      and (np.de is null or o.data_evento between np.de and np.ate)
  ),
  devs as (
    select distinct d.* from public.devolucoes d
    join public.itens_devolucao it on it.devolucao_id = d.id, no_periodo np
    where d.empresa_id = p_empresa and d.status <> 'RASCUNHO'
      and (it.bem_id in (select id from bs) or it.lote_id in (select id from ls))
      and (np.de is null or d.solicitada_em between np.de and np.ate
           or d.retirada_em between np.de and np.ate)
  ),
  recs as (
    select distinct r.* from public.recebimentos r
    join public.itens_recebimento ir on ir.recebimento_id = r.id, no_periodo np
    where r.empresa_id = p_empresa and r.status in ('CONFIRMADO', 'CANCELADO')
      and (ir.bem_id in (select id from bs) or ir.lote_id in (select id from ls))
      and (np.de is null or r.data_evento between np.de and np.ate)
  ),
  -- Evidências das entidades no escopo, com o contexto da legenda.
  evid as (
    select e.*,
      case e.entidade_tipo
        when 'BEM' then 'Ficha do bem'
        when 'LOTE' then 'Ficha do lote'
        when 'ITEM_RECEBIMENTO' then 'Recebimento ' || (select r.codigo from public.itens_recebimento ir join public.recebimentos r on r.id = ir.recebimento_id where ir.id = e.entidade_id)
        when 'RECEBIMENTO' then 'Recebimento ' || (select codigo from public.recebimentos where id = e.entidade_id)
        when 'VISTORIA' then 'Vistoria ' || lower((select tipo::text from public.vistorias where id = e.entidade_id))
          || coalesce(' — pergunta ' || (select p.ordem::text from public.perguntas_checklist p where p.id = e.pergunta_id), '')
        when 'MOVIMENTACAO' then 'Movimentação ' || (select codigo from public.movimentacoes where id = e.entidade_id)
        when 'OCORRENCIA' then 'Ocorrência ' || (select codigo || ' (' || lower(replace(tipo::text, '_', ' ')) || ')' from public.ocorrencias where id = e.entidade_id)
        when 'DEVOLUCAO' then 'Devolução ' || (select codigo from public.devolucoes where id = e.entidade_id)
        else e.entidade_tipo::text
      end as evento,
      coalesce(
        case e.entidade_tipo
          when 'BEM' then e.entidade_id
          when 'ITEM_RECEBIMENTO' then (select bem_id from public.itens_recebimento where id = e.entidade_id)
          when 'VISTORIA' then (select bem_id from public.vistorias where id = e.entidade_id)
          when 'MOVIMENTACAO' then (select bem_id from public.movimentacoes where id = e.entidade_id)
          when 'OCORRENCIA' then (select bem_id from public.ocorrencias where id = e.entidade_id)
        end, null) as bem_ref,
      case e.entidade_tipo
        when 'LOTE' then e.entidade_id
        when 'ITEM_RECEBIMENTO' then (select lote_id from public.itens_recebimento where id = e.entidade_id)
        when 'VISTORIA' then (select lote_id from public.vistorias where id = e.entidade_id)
        when 'MOVIMENTACAO' then (select coalesce(lote_destino_id, lote_id) from public.movimentacoes where id = e.entidade_id)
        when 'OCORRENCIA' then (select lote_id from public.ocorrencias where id = e.entidade_id)
      end as lote_ref,
      case e.entidade_tipo
        when 'ITEM_RECEBIMENTO' then (select r.local_id from public.itens_recebimento ir join public.recebimentos r on r.id = ir.recebimento_id where ir.id = e.entidade_id)
        when 'RECEBIMENTO' then (select local_id from public.recebimentos where id = e.entidade_id)
        when 'MOVIMENTACAO' then (select destino_local_id from public.movimentacoes where id = e.entidade_id)
      end as local_evento
    from public.evidencias e
    where p_fotos and e.empresa_id = p_empresa and e.status = 'ATIVA'
      and (
        (e.entidade_tipo = 'BEM' and e.entidade_id in (select id from bs))
        or (e.entidade_tipo = 'LOTE' and e.entidade_id in (select id from ls))
        or (e.entidade_tipo = 'VISTORIA' and e.entidade_id in (select id from vist))
        or (e.entidade_tipo = 'MOVIMENTACAO' and e.entidade_id in (select id from movs))
        or (e.entidade_tipo = 'OCORRENCIA' and e.entidade_id in (select id from ocors))
        or (e.entidade_tipo = 'DEVOLUCAO' and e.entidade_id in (select id from devs))
        or (e.entidade_tipo = 'ITEM_RECEBIMENTO' and e.entidade_id in (
              select ir.id from public.itens_recebimento ir
              where ir.bem_id in (select id from bs) or ir.lote_id in (select id from ls)))
      )
  )
  select jsonb_build_object(
    'bens', case when p_fichas then coalesce((
      select jsonb_agg(jsonb_build_object(
        'codigo', b.codigo, 'item', i.descricao, 'status', b.status, 'numero_serie', b.numero_serie,
        'placa', b.placa, 'identificacao_fornecedor', b.identificacao_fornecedor,
        'local', lc.nome, 'responsavel', privado.nome_usuario(b.responsavel_atual_id),
        'substitui', (select codigo from public.bens where id = b.substitui_bem_id)) order by b.codigo)
      from bs b join public.itens_locacao i on i.id = b.item_locacao_id
      left join public.locais lc on lc.id = b.local_atual_id), '[]') else '[]' end,
    'lotes', case when p_fichas then coalesce((
      select jsonb_agg(jsonb_build_object(
        'codigo', l.codigo, 'item', i.descricao, 'unidade', i.unidade, 'status', l.status,
        'recebida', l.quantidade_recebida::text, 'devolvida', l.quantidade_devolvida::text,
        'dividida', l.quantidade_dividida::text, 'baixada', l.quantidade_baixada::text, 'saldo', l.saldo::text,
        'local', lc.nome, 'responsavel', privado.nome_usuario(l.responsavel_atual_id),
        'origem', (select codigo from public.lotes where id = l.lote_origem_id)) order by l.codigo)
      from ls l join public.itens_locacao i on i.id = l.item_locacao_id
      left join public.locais lc on lc.id = l.local_atual_id), '[]') else '[]' end,
    'recebimentos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'codigo', r.codigo, 'status', r.status, 'data_evento', r.data_evento,
        'local', (select nome from public.locais where id = r.local_id),
        'responsavel', privado.nome_usuario(r.responsavel_id), 'recebido_por', privado.nome_usuario(r.recebido_por),
        'linhas', (select jsonb_agg(jsonb_build_object(
            'item', i.descricao, 'alvo', coalesce(b.codigo, lt.codigo, '—'), 'quantidade', ir.quantidade::text,
            'condicao', ir.condicao) order by ir.created_at)
          from public.itens_recebimento ir join public.itens_locacao i on i.id = ir.item_locacao_id
          left join public.bens b on b.id = ir.bem_id left join public.lotes lt on lt.id = ir.lote_id
          where ir.recebimento_id = r.id)) order by r.data_evento)
      from recs r), '[]'),
    'vistorias', coalesce((
      select jsonb_agg(jsonb_build_object(
        'tipo', v.tipo, 'status', v.status, 'data_evento', v.data_evento,
        'alvo', coalesce((select codigo from public.bens where id = v.bem_id), (select codigo from public.lotes where id = v.lote_id)),
        'modelo', mc.nome, 'versao', mc.versao, 'realizada_por', privado.nome_usuario(v.realizada_por),
        'respostas', (select jsonb_agg(jsonb_build_object(
            'ordem', p.ordem, 'pergunta', p.texto, 'resposta', rv.resposta_json #>> '{}') order by p.ordem)
          from public.perguntas_checklist p
          left join public.respostas_vistoria rv on rv.vistoria_id = v.id and rv.pergunta_id = p.id
          where p.modelo_id = v.modelo_id)) order by v.data_evento)
      from vist v join public.modelos_checklist mc on mc.id = v.modelo_id), '[]'),
    'movimentacoes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'codigo', m.codigo, 'status', m.status, 'data_evento', m.data_evento,
        'alvo', coalesce((select codigo from public.bens where id = m.bem_id), (select codigo from public.lotes where id = m.lote_id)),
        'quantidade', m.quantidade::text,
        'origem', (select nome from public.locais where id = m.origem_local_id),
        'destino', (select nome from public.locais where id = m.destino_local_id),
        'responsavel_anterior', privado.nome_usuario(m.responsavel_anterior_id),
        'novo_responsavel', privado.nome_usuario(m.novo_responsavel_id),
        'motivo', m.motivo, 'aceite_administrativo', m.aceite_administrativo) order by m.data_evento, m.created_at)
      from movs m), '[]'),
    'ocorrencias', coalesce((
      select jsonb_agg(jsonb_build_object(
        'codigo', o.codigo, 'tipo', o.tipo, 'status', o.status, 'prioridade', o.prioridade,
        'data_evento', o.data_evento, 'prazo', o.prazo,
        'alvo', coalesce((select codigo from public.bens where id = o.bem_id), (select codigo from public.lotes where id = o.lote_id)),
        'descricao', o.descricao, 'resultado', o.resultado, 'resolucao', o.resolucao) order by o.data_evento)
      from ocors o), '[]'),
    'devolucoes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'codigo', d.codigo, 'status', d.status, 'solicitada_em', d.solicitada_em, 'agendada_para', d.agendada_para,
        'retirada_em', d.retirada_em, 'recebedor', d.fornecedor_recebedor, 'conferida_em', d.conferida_em,
        'ciencia_financeira_em', d.ciencia_financeira_em, 'motivo_cancelamento', d.motivo_cancelamento,
        'itens', (select jsonb_agg(jsonb_build_object(
            'alvo', coalesce(b.codigo, lt.codigo), 'solicitada', it.quantidade_solicitada::text,
            'retirada', it.quantidade_retirada::text, 'condicao', it.condicao_saida) order by it.created_at)
          from public.itens_devolucao it left join public.bens b on b.id = it.bem_id
          left join public.lotes lt on lt.id = it.lote_id where it.devolucao_id = d.id),
        'comprovantes', (select jsonb_agg(jsonb_build_object('nome', e.nome_original, 'hash', e.hash_arquivo,
            'enviada_em', e.enviada_em) order by e.enviada_em)
          from public.evidencias e where e.entidade_tipo = 'DEVOLUCAO' and e.entidade_id = d.id
            and e.tipo = 'COMPROVANTE' and e.status = 'ATIVA')) order by d.solicitada_em)
      from devs d), '[]'),
    'evidencias', coalesce((
      select jsonb_agg(x order by x->>'data', x->>'id') from (
        select jsonb_build_object(
          'id', e.id, 'tipo', e.tipo, 'bucket', e.bucket, 'storage_path', e.storage_path, 'mime', e.mime_type,
          'nome', e.nome_original, 'hash', e.hash_arquivo,
          'data', coalesce(e.capturada_em, e.enviada_em), 'enviada_em', e.enviada_em,
          'legenda', jsonb_build_object(
            'evento', e.evento,
            'item', coalesce((select codigo from public.bens where id = e.bem_ref), (select codigo from public.lotes where id = e.lote_ref)),
            'local', coalesce((select nome from public.locais where id = e.local_evento),
                              (select lc.nome from public.bens b join public.locais lc on lc.id = b.local_atual_id where b.id = e.bem_ref),
                              (select lc.nome from public.lotes l join public.locais lc on lc.id = l.local_atual_id where l.id = e.lote_ref)),
            'usuario', privado.nome_usuario(e.enviada_por),
            'texto', e.legenda)) as x
        from evid e
        order by coalesce(e.capturada_em, e.enviada_em), e.id
        limit p_limite_fotos) s), '[]'),
    'evidencias_total', (select count(*) from evid)
  )
$$;

-- Snapshot completo do relatório (somente worker/service_role).
create function public.relatorio_snapshot(p_relatorio uuid, p_limite_fotos integer default 300)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r public.relatorios;
  e public.empresas;
  v_alvo uuid;
  v_valores boolean;
  l public.locacoes;
  v_bens uuid[];
  v_lotes uuid[];
  v_de timestamptz;
  v_ate timestamptz;
  v_cabecalho jsonb;
  v_locacao jsonb := null;
begin
  select * into r from public.relatorios where id = p_relatorio;
  if not found then
    raise exception 'Relatório não encontrado' using errcode = 'P0002';
  end if;
  select * into e from public.empresas where id = r.empresa_id;
  v_alvo := (r.parametros->>'alvo')::uuid;
  v_valores := coalesce((r.parametros->>'incluir_valores')::boolean, false);
  v_cabecalho := jsonb_build_object(
    'relatorio', jsonb_build_object('id', r.id, 'codigo', r.codigo, 'tipo', r.tipo,
      'versao_template', r.versao_template, 'solicitado_em', r.created_at,
      'solicitado_por', privado.nome_usuario(r.solicitado_por)),
    'empresa', jsonb_build_object('nome', e.nome, 'timezone', e.timezone),
    'incluir_valores', v_valores);

  if r.tipo = 'LOCACAO' then
    select * into l from public.locacoes where id = v_alvo and empresa_id = r.empresa_id;
    select array_agg(b.id) into v_bens from public.bens b join public.itens_locacao i on i.id = b.item_locacao_id
     where i.locacao_id = l.id;
    select array_agg(lt.id) into v_lotes from public.lotes lt join public.itens_locacao i on i.id = lt.item_locacao_id
     where i.locacao_id = l.id;
  elsif r.tipo = 'BEM' then
    select array[b.id] into v_bens from public.bens b where b.id = v_alvo and b.empresa_id = r.empresa_id;
    v_lotes := '{}';
    select lc.* into l from public.locacoes lc join public.itens_locacao i on i.locacao_id = lc.id
     join public.bens b on b.item_locacao_id = i.id where b.id = v_alvo;
  elsif r.tipo = 'LOCAL' then
    select array_agg(b.id) into v_bens from public.bens b
     where b.empresa_id = r.empresa_id and b.local_atual_id = v_alvo and public.status_bem_ativo(b.status);
    select array_agg(lt.id) into v_lotes from public.lotes lt
     where lt.empresa_id = r.empresa_id and lt.local_atual_id = v_alvo and lt.status = 'ATIVO';
  else
    -- PERIODO: todos os itens da empresa, eventos no intervalo (dias civis no fuso da empresa).
    v_bens := null;
    v_lotes := null;
    v_de := ((r.parametros->>'inicio')::date)::timestamp at time zone e.timezone;
    v_ate := (((r.parametros->>'fim')::date + 1)::timestamp at time zone e.timezone) - interval '1 microsecond';
  end if;
  v_bens := case when r.tipo = 'PERIODO' then null else coalesce(v_bens, '{}') end;
  v_lotes := case when r.tipo = 'PERIODO' then null else coalesce(v_lotes, '{}') end;

  if l.id is not null then
    v_locacao := jsonb_build_object(
      'codigo', l.codigo, 'status', l.status, 'status_financeiro', l.status_financeiro,
      'fornecedor', (select jsonb_build_object('razao_social', f.razao_social, 'nome_fantasia', f.nome_fantasia,
                                               'documento', f.documento) from public.fornecedores f where f.id = l.fornecedor_id),
      'centro_custo', (select c.codigo || ' · ' || c.nome from public.centros_custo c where c.id = l.centro_custo_id),
      'inicio_previsto', l.inicio_previsto, 'termino_previsto', l.termino_previsto, 'inicio_efetivo', l.inicio_efetivo,
      'ativada_em', l.ativada_em, 'observacoes', l.observacoes,
      'desmobilizacao_iniciada_em', l.desmobilizacao_iniciada_em,
      'encerrada_operacional_em', l.encerrada_operacional_em,
      'data_encerramento_financeiro', l.data_encerramento_financeiro,
      'referencias', coalesce((select jsonb_agg(jsonb_build_object('sistema', x.sistema, 'tipo', x.tipo,
          'numero', x.numero, 'data_documento', x.data_documento) order by x.sistema, x.numero)
        from public.referencias_externas x where x.locacao_id = l.id), '[]'),
      'itens', coalesce((select jsonb_agg(jsonb_build_object(
          'descricao', i.descricao, 'modo', i.modo_controle, 'unidade', i.unidade,
          'contratada', i.quantidade_contratada::text, 'periodicidade', i.periodicidade,
          'valor_unitario', case when v_valores then i.valor_unitario::text end,
          'recebida', s.quantidade_recebida::text, 'devolvida', s.quantidade_devolvida::text,
          'saldo', s.saldo::text) order by i.descricao)
        from public.itens_locacao i join public.v_saldo_item_locacao s on s.item_locacao_id = i.id
        where i.locacao_id = l.id and (r.tipo = 'LOCACAO' or i.id = (select item_locacao_id from public.bens where id = v_alvo))), '[]'),
      'cobrancas', case when v_valores and r.tipo = 'LOCACAO' then coalesce((select jsonb_agg(jsonb_build_object(
          'codigo', c.codigo, 'competencia_inicio', c.competencia_inicio, 'competencia_fim', c.competencia_fim,
          'valor', c.valor_cobrado::text, 'documento', c.numero_documento, 'status', c.status) order by c.competencia_inicio)
        from public.cobrancas c where c.locacao_id = l.id), '[]') end);
  end if;

  return v_cabecalho
    || jsonb_build_object(
         'alvo', case r.tipo
           when 'LOCAL' then (select jsonb_build_object('codigo', codigo, 'nome', nome, 'tipo', tipo) from public.locais where id = v_alvo)
           when 'BEM' then (select jsonb_build_object('codigo', codigo) from public.bens where id = v_alvo)
           when 'PERIODO' then jsonb_build_object('inicio', r.parametros->>'inicio', 'fim', r.parametros->>'fim')
           else jsonb_build_object('codigo', l.codigo) end,
         'locacao', v_locacao)
    || privado.relatorio_secoes(r.empresa_id, v_bens, v_lotes, v_de, v_ate,
                                r.tipo <> 'PERIODO', r.tipo <> 'PERIODO', p_limite_fotos);
end
$$;

-- ------------------------------------------------------------- privilégios --
revoke insert, update, delete on public.relatorios from authenticated;
revoke all on function privado.nome_usuario(uuid),
  privado.relatorio_secoes(uuid, uuid[], uuid[], timestamptz, timestamptz, boolean, boolean, integer)
from public, anon, authenticated;
revoke all on function public.rpc_solicitar_relatorio(public.tipo_relatorio, uuid, date, date, text) from public, anon;
grant execute on function public.rpc_solicitar_relatorio(public.tipo_relatorio, uuid, date, date, text) to authenticated;
revoke all on function public.relatorio_reivindicar(), public.relatorio_concluir(uuid, text, text, text, text),
  public.relatorio_falhar(uuid, text), public.relatorio_snapshot(uuid, integer)
from public, anon, authenticated;
grant execute on function public.relatorio_reivindicar(), public.relatorio_concluir(uuid, text, text, text, text),
  public.relatorio_falhar(uuid, text), public.relatorio_snapshot(uuid, integer)
to service_role;
