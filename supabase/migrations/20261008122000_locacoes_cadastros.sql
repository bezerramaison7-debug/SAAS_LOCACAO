-- =============================================================================
-- 012 — Funções de domínio da Fase 4: locação (ativar, cancelar, buscar) e
--        checklists versionados (publicar, nova versão).
-- Convenções (D-04): security definer, search_path vazio, empresa derivada da
-- linha-alvo, permissão revalidada, linha travada (for update), auditoria
-- semântica. Erros: 42501 · P0002 · 22023 (com a lista de pendências).
-- =============================================================================

-- Pendências que impedem a ativação (RN-13). Também usada pela interface.
create function public.pendencias_ativacao_locacao(p_locacao uuid)
returns text[]
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v public.locacoes;
  v_pendencias text[] := '{}';
begin
  select * into v from public.locacoes where id = p_locacao;
  if not found or not privado.pode_ler(v.empresa_id) then
    raise exception 'Locação não encontrada' using errcode = 'P0002';
  end if;
  if v.fornecedor_id is null then
    v_pendencias := array_append(v_pendencias, 'Informe o fornecedor');
  elsif not exists (select 1 from public.fornecedores f where f.id = v.fornecedor_id and f.ativo) then
    v_pendencias := array_append(v_pendencias, 'O fornecedor está inativo');
  end if;
  if v.centro_custo_id is null then
    v_pendencias := array_append(v_pendencias, 'Informe o centro de custo');
  elsif not exists (select 1 from public.centros_custo c where c.id = v.centro_custo_id and c.ativo) then
    v_pendencias := array_append(v_pendencias, 'O centro de custo está inativo');
  end if;
  if v.inicio_previsto is null or v.termino_previsto is null then
    v_pendencias := array_append(v_pendencias, 'Informe o início e o término previstos');
  end if;
  if not exists (select 1 from public.itens_locacao i where i.locacao_id = v.id) then
    v_pendencias := array_append(v_pendencias, 'Inclua ao menos um item contratado');
  end if;
  if exists (select 1 from public.itens_locacao i join public.categorias_bem c on c.id = i.categoria_id
             where i.locacao_id = v.id and not c.ativo) then
    v_pendencias := array_append(v_pendencias, 'Há item com categoria inativa');
  end if;
  if not exists (select 1 from public.referencias_externas r
                 where r.locacao_id = v.id and r.sistema = 'SECTRA' and r.tipo = 'PEDIDO') then
    v_pendencias := array_append(v_pendencias, 'Vincule o pedido do Sectra');
  end if;
  return v_pendencias;
end
$$;

create function public.rpc_ativar_locacao(p_locacao uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v public.locacoes;
  v_pendencias text[];
begin
  select * into v from public.locacoes where id = p_locacao for update;
  if not found or not privado.pode_ler(v.empresa_id) then
    raise exception 'Locação não encontrada' using errcode = 'P0002';
  end if;
  if not privado.usuario_tem_permissao(v.empresa_id, 'locacao.ativar') then
    raise exception 'Sem permissão para ativar locações' using errcode = '42501';
  end if;
  if v.status <> 'RASCUNHO' then
    raise exception 'Somente locações em rascunho podem ser ativadas' using errcode = '22023';
  end if;
  v_pendencias := public.pendencias_ativacao_locacao(p_locacao);
  if cardinality(v_pendencias) > 0 then
    raise exception 'Locação incompleta: %', array_to_string(v_pendencias, '; ') using errcode = '22023';
  end if;
  update public.locacoes
     set status = 'ATIVA', ativada_em = now(), ativada_por = (select auth.uid())
   where id = p_locacao;
  perform privado.registrar_auditoria(
    v.empresa_id, 'locacao.ativar', 'locacoes', p_locacao,
    jsonb_build_object('status', v.status), jsonb_build_object('status', 'ATIVA'), null);
end
$$;

-- RN-14: cancela rascunho, ou ativa sem nenhum recebimento confirmado.
create function public.rpc_cancelar_locacao(p_locacao uuid, p_motivo text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v public.locacoes;
  v_motivo text := trim(coalesce(p_motivo, ''));
begin
  select * into v from public.locacoes where id = p_locacao for update;
  if not found or not privado.pode_ler(v.empresa_id) then
    raise exception 'Locação não encontrada' using errcode = 'P0002';
  end if;
  if not privado.usuario_tem_permissao(v.empresa_id, 'locacao.cancelar') then
    raise exception 'Sem permissão para cancelar locações' using errcode = '42501';
  end if;
  if v.status not in ('RASCUNHO', 'ATIVA') then
    raise exception 'Esta locação não pode mais ser cancelada' using errcode = '22023';
  end if;
  if length(v_motivo) < 10 then
    raise exception 'Informe o motivo com pelo menos 10 caracteres' using errcode = '22023';
  end if;
  if exists (select 1 from public.recebimentos r
             where r.locacao_id = p_locacao and r.confirmado_em is not null) then
    raise exception 'Locação com recebimento confirmado não pode ser cancelada' using errcode = '22023';
  end if;
  -- Rascunhos de recebimento são cancelados junto.
  update public.recebimentos
     set status = 'CANCELADO', cancelado_em = now(), cancelado_por = (select auth.uid()),
         motivo_cancelamento = 'Locação cancelada: ' || v_motivo
   where locacao_id = p_locacao and status in ('RASCUNHO', 'AGUARDANDO_AUTORIZACAO');
  update public.locacoes
     set status = 'CANCELADA', cancelada_em = now(), cancelada_por = (select auth.uid()),
         motivo_cancelamento = v_motivo
   where id = p_locacao;
  perform privado.registrar_auditoria(
    v.empresa_id, 'locacao.cancelar', 'locacoes', p_locacao,
    jsonb_build_object('status', v.status), jsonb_build_object('status', 'CANCELADA'),
    jsonb_build_object('motivo', v_motivo));
end
$$;

-- Busca server-side de locações (security invoker: a RLS de quem consulta vale).
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
  p_offset integer default 0
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

-- ------------------------------------------------------------- checklists ----
create function public.rpc_publicar_checklist(p_modelo uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v public.modelos_checklist;
begin
  select * into v from public.modelos_checklist where id = p_modelo for update;
  if not found or not privado.usuario_pertence_empresa(v.empresa_id) then
    raise exception 'Modelo não encontrado' using errcode = 'P0002';
  end if;
  if not privado.usuario_tem_permissao(v.empresa_id, 'checklist.gerenciar') then
    raise exception 'Sem permissão para gerenciar checklists' using errcode = '42501';
  end if;
  if v.status <> 'RASCUNHO' then
    raise exception 'Somente versões em rascunho podem ser publicadas' using errcode = '22023';
  end if;
  if not exists (select 1 from public.perguntas_checklist where modelo_id = p_modelo) then
    raise exception 'Inclua ao menos uma pergunta antes de publicar' using errcode = '22023';
  end if;
  -- A versão vigente anterior da mesma família é arquivada (vistorias antigas a mantêm).
  update public.modelos_checklist set status = 'ARQUIVADO'
   where empresa_id = v.empresa_id and familia_id = v.familia_id and status = 'PUBLICADO';
  update public.modelos_checklist
     set status = 'PUBLICADO', publicado_em = now(), publicado_por = (select auth.uid())
   where id = p_modelo;
  perform privado.registrar_auditoria(
    v.empresa_id, 'checklist.publicar', 'modelos_checklist', p_modelo, null,
    jsonb_build_object('familia_id', v.familia_id, 'versao', v.versao), null);
end
$$;

-- Nova versão (RASCUNHO) copiando as perguntas da versão informada.
create function public.rpc_nova_versao_checklist(p_modelo uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v public.modelos_checklist;
  v_novo uuid;
  v_versao integer;
begin
  select * into v from public.modelos_checklist where id = p_modelo;
  if not found or not privado.usuario_pertence_empresa(v.empresa_id) then
    raise exception 'Modelo não encontrado' using errcode = 'P0002';
  end if;
  if not privado.usuario_tem_permissao(v.empresa_id, 'checklist.gerenciar') then
    raise exception 'Sem permissão para gerenciar checklists' using errcode = '42501';
  end if;
  if exists (select 1 from public.modelos_checklist
             where empresa_id = v.empresa_id and familia_id = v.familia_id and status = 'RASCUNHO') then
    raise exception 'Já existe uma versão em rascunho deste checklist' using errcode = '22023';
  end if;
  select max(versao) + 1 into v_versao from public.modelos_checklist
   where empresa_id = v.empresa_id and familia_id = v.familia_id;
  insert into public.modelos_checklist (empresa_id, familia_id, versao, nome, descricao)
  values (v.empresa_id, v.familia_id, v_versao, v.nome, v.descricao)
  returning id into v_novo;
  insert into public.perguntas_checklist
    (empresa_id, modelo_id, ordem, texto, tipo_resposta, opcoes, obrigatoria, exige_foto_se)
  select empresa_id, v_novo, ordem, texto, tipo_resposta, opcoes, obrigatoria, exige_foto_se
  from public.perguntas_checklist where modelo_id = p_modelo;
  perform privado.registrar_auditoria(
    v.empresa_id, 'checklist.nova_versao', 'modelos_checklist', v_novo, null,
    jsonb_build_object('familia_id', v.familia_id, 'versao', v_versao, 'origem', p_modelo), null);
  return v_novo;
end
$$;

revoke all on function
  public.pendencias_ativacao_locacao(uuid),
  public.rpc_ativar_locacao(uuid),
  public.rpc_cancelar_locacao(uuid, text),
  public.buscar_locacoes(uuid, text, public.status_locacao[], uuid, uuid, uuid, date, date, date, integer, integer),
  public.rpc_publicar_checklist(uuid),
  public.rpc_nova_versao_checklist(uuid)
from public, anon;

grant execute on function
  public.pendencias_ativacao_locacao(uuid),
  public.rpc_ativar_locacao(uuid),
  public.rpc_cancelar_locacao(uuid, text),
  public.buscar_locacoes(uuid, text, public.status_locacao[], uuid, uuid, uuid, date, date, date, integer, integer),
  public.rpc_publicar_checklist(uuid),
  public.rpc_nova_versao_checklist(uuid)
to authenticated;
