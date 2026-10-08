-- =============================================================================
-- 008 — Visões de saldo (docs/business-rules.md §5.1, D-10).
-- `security_invoker = true`: a visão é avaliada com a RLS de quem consulta.
-- =============================================================================

-- Estados em que o bem continua sob responsabilidade da empresa (EXTRAVIADO
-- conta até ser resolvido — RN-43).
create function public.status_bem_ativo(p_status public.status_bem)
returns boolean
language sql immutable
set search_path = ''
as $$
  select p_status = any (array[
    'DISPONIVEL', 'EM_USO', 'EM_TRANSFERENCIA', 'EM_MANUTENCAO', 'DEVOLUCAO_SOLICITADA', 'EXTRAVIADO'
  ]::public.status_bem[])
$$;

create view public.v_saldo_item_locacao
with (security_invoker = true)
as
select
  i.id as item_locacao_id,
  i.empresa_id,
  i.locacao_id,
  i.modo_controle,
  i.unidade,
  i.quantidade_contratada,
  case i.modo_controle
    when 'INDIVIDUAL' then (
      -- Substitutos ocupam a vaga do substituído: não contam como recebidos.
      select count(*)::numeric(14, 3) from public.bens b
      where b.item_locacao_id = i.id
        and b.status not in ('AGUARDANDO_RECEBIMENTO', 'CANCELADO')
        and b.substitui_bem_id is null)
    else (
      select coalesce(sum(l.quantidade_recebida), 0)::numeric(14, 3) from public.lotes l
      where l.item_locacao_id = i.id and l.lote_origem_id is null and l.status <> 'CANCELADO')
  end as quantidade_recebida,
  case i.modo_controle
    when 'INDIVIDUAL' then (
      select count(*)::numeric(14, 3) from public.bens b
      where b.item_locacao_id = i.id and b.status = 'DEVOLVIDO')
    else (
      select coalesce(sum(l.quantidade_devolvida), 0)::numeric(14, 3) from public.lotes l
      where l.item_locacao_id = i.id and l.status <> 'CANCELADO')
  end as quantidade_devolvida,
  case i.modo_controle
    when 'INDIVIDUAL' then (
      select count(*)::numeric(14, 3) from public.bens b
      where b.item_locacao_id = i.id and public.status_bem_ativo(b.status))
    else (
      select coalesce(sum(l.saldo), 0)::numeric(14, 3) from public.lotes l
      where l.item_locacao_id = i.id and l.status = 'ATIVO')
  end as saldo
from public.itens_locacao i;

create view public.v_saldo_locacao
with (security_invoker = true)
as
select
  l.id as locacao_id,
  l.empresa_id,
  l.status,
  l.status_financeiro,
  coalesce(sum(s.saldo) filter (where s.modo_controle = 'INDIVIDUAL'), 0)::numeric(14, 3) as bens_ativos,
  coalesce(sum(s.saldo) filter (where s.modo_controle = 'LOTE'), 0)::numeric(14, 3) as saldo_lotes,
  coalesce(sum(s.saldo), 0)::numeric(14, 3) as saldo_total,
  coalesce(sum(greatest(s.quantidade_contratada - s.quantidade_recebida, 0)), 0)::numeric(14, 3) as a_receber
from public.locacoes l
left join public.v_saldo_item_locacao s on s.locacao_id = l.id
group by l.id, l.empresa_id, l.status, l.status_financeiro;
