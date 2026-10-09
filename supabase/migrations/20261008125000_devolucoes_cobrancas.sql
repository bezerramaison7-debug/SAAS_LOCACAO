-- =============================================================================
-- 015 — Fase 7: devolução em etapas (solicitação → agendamento → retirada →
--        conferência), vistoria de saída, comprovante, ciência financeira,
--        cobranças, estimativa e os DOIS encerramentos independentes (RN-60..62).
-- Convenções (D-04): security definer, search_path vazio, empresa derivada da
-- linha-alvo, permissão revalidada, linhas travadas (for update), auditoria.
-- O saldo só muda na confirmação da retirada (RN-53); retirada nunca encerra
-- cobrança (RN-55); nenhum encerramento dispara o outro (RN-62).
-- =============================================================================

-- ------------------------------------------------------ ajustes de esquema ---
-- Vistoria de saída é feita por item da devolução (como a de entrada por linha).
alter table public.vistorias add column item_devolucao_id uuid;
alter table public.vistorias
  add constraint vistorias_item_devolucao_fk
  foreign key (empresa_id, item_devolucao_id) references public.itens_devolucao (empresa_id, id),
  add constraint vistorias_saida_item check (item_devolucao_id is null or tipo = 'SAIDA');
create index vistorias_item_devolucao_idx on public.vistorias (empresa_id, item_devolucao_id)
  where item_devolucao_id is not null;
create unique index vistorias_saida_item_uk on public.vistorias (item_devolucao_id)
  where item_devolucao_id is not null and status <> 'CANCELADA';

-- Devolução que desmobilizou a locação automaticamente (D-15): cancelá-la
-- devolve a locação a ATIVA se nenhuma outra devolução aberta cobrir o saldo.
alter table public.locacoes add column desmobilizacao_devolucao_id uuid;
alter table public.locacoes
  add constraint locacoes_desmobilizacao_devolucao_fk
  foreign key (empresa_id, desmobilizacao_devolucao_id) references public.devolucoes (empresa_id, id);
create index locacoes_desmobilizacao_devolucao_idx on public.locacoes (empresa_id, desmobilizacao_devolucao_id)
  where desmobilizacao_devolucao_id is not null;

-- Escritas só pelas funções de domínio (estados, saldo e reservas são transacionais).
revoke insert, update on public.devolucoes from authenticated;
revoke insert, update, delete on public.itens_devolucao from authenticated;
drop policy devolucoes_insert on public.devolucoes;
drop policy devolucoes_update on public.devolucoes;
drop policy itens_devolucao_insert on public.itens_devolucao;
drop policy itens_devolucao_update on public.itens_devolucao;
drop policy itens_devolucao_delete on public.itens_devolucao;

-- ------------------------------------------------------------ auxiliares ---
create function privado.locacao_para_devolucao(p_locacao uuid) returns public.locacoes
language plpgsql security definer
set search_path = ''
as $$
declare
  l public.locacoes;
begin
  select * into l from public.locacoes where id = p_locacao for update;
  if not found or not privado.pode_ler(l.empresa_id) then
    raise exception 'Locação não encontrada' using errcode = 'P0002';
  end if;
  if not privado.usuario_tem_permissao(l.empresa_id, 'devolucao.gerenciar') then
    raise exception 'Sem permissão para gerenciar devoluções' using errcode = '42501';
  end if;
  return l;
end
$$;

create function privado.devolucao_gerenciavel(p_devolucao uuid) returns public.devolucoes
language plpgsql security definer
set search_path = ''
as $$
declare
  d public.devolucoes;
begin
  select * into d from public.devolucoes where id = p_devolucao for update;
  if not found or not privado.pode_ler(d.empresa_id) then
    raise exception 'Devolução não encontrada' using errcode = 'P0002';
  end if;
  if not privado.usuario_tem_permissao(d.empresa_id, 'devolucao.gerenciar') then
    raise exception 'Sem permissão para gerenciar devoluções' using errcode = '42501';
  end if;
  -- Serializa as operações da mesma locação (saldo e reservas).
  perform 1 from public.locacoes where id = d.locacao_id for update;
  return d;
end
$$;

-- Saldo da locação (bens ativos + saldo dos lotes ativos — §5.1).
create function privado.saldo_locacao(p_locacao uuid) returns numeric
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select count(*) from public.bens b join public.itens_locacao i on i.id = b.item_locacao_id
                   where i.locacao_id = p_locacao and public.status_bem_ativo(b.status)), 0)
       + coalesce((select sum(l.saldo) from public.lotes l join public.itens_locacao i on i.id = l.item_locacao_id
                   where i.locacao_id = p_locacao and l.status = 'ATIVO'), 0)
$$;

-- Devoluções abertas cobrem todo o saldo? (todo bem ativo solicitado e todo lote reservado)
create function privado.devolucoes_cobrem_saldo(p_locacao uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select privado.saldo_locacao(p_locacao) > 0
    and not exists (
      select 1 from public.bens b join public.itens_locacao i on i.id = b.item_locacao_id
      where i.locacao_id = p_locacao and public.status_bem_ativo(b.status) and b.status <> 'DEVOLUCAO_SOLICITADA')
    and not exists (
      select 1 from public.lotes l join public.itens_locacao i on i.id = l.item_locacao_id
      where i.locacao_id = p_locacao and l.status = 'ATIVO' and privado.reserva_lote(l.id) < l.saldo)
$$;

-- RN-55/D-15: saldo zerado pela retirada → pendência de encerramento financeiro.
create function privado.atualizar_financeiro_por_saldo(p_locacao uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  l public.locacoes;
begin
  select * into l from public.locacoes where id = p_locacao for update;
  if privado.saldo_locacao(p_locacao) = 0 and l.status_financeiro in ('NAO_INICIADO', 'EM_COBRANCA') then
    update public.locacoes set status_financeiro = 'ENCERRAMENTO_PENDENTE' where id = p_locacao;
    perform privado.registrar_auditoria(
      l.empresa_id, 'financeiro.encerramento_pendente', 'locacoes', l.id,
      jsonb_build_object('status_financeiro', l.status_financeiro),
      jsonb_build_object('status_financeiro', 'ENCERRAMENTO_PENDENTE'), jsonb_build_object('motivo', 'saldo_zerado'));
  end if;
end
$$;

-- Restaura o bem de um item que não sai (cancelamento ou não retirado).
-- Extraviado durante a devolução: corrige o "estado anterior" da ocorrência.
create function privado.liberar_item_devolucao(p_item uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  it public.itens_devolucao;
begin
  select * into it from public.itens_devolucao where id = p_item for update;
  if it.bem_id is not null then
    update public.bens set status = it.status_anterior_bem
     where id = it.bem_id and status = 'DEVOLUCAO_SOLICITADA';
    update public.ocorrencias set status_anterior_bem = it.status_anterior_bem
     where bem_id = it.bem_id and tipo = 'EXTRAVIO' and status in ('ABERTA', 'EM_TRATAMENTO')
       and status_anterior_bem = 'DEVOLUCAO_SOLICITADA';
  end if;
  update public.itens_devolucao set ativo = false where id = p_item;
  update public.vistorias set status = 'CANCELADA', cancelada_em = now()
   where item_devolucao_id = p_item and status = 'RASCUNHO';
end
$$;

-- ------------------------------------------------------------- devolução ---
-- Solicitação (RN-50..52): itens = [{"bem": uuid} | {"lote": uuid, "quantidade": n}].
create function public.rpc_solicitar_devolucao(
  p_locacao uuid,
  p_itens jsonb,
  p_observacoes text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  loc public.locacoes;
  b public.bens;
  lt public.lotes;
  e jsonb;
  v_id uuid;
  v_qtd numeric;
  v_disponivel numeric;
  v_n integer := 0;
begin
  loc := privado.locacao_para_devolucao(p_locacao);
  if loc.status not in ('ATIVA', 'EM_DEVOLUCAO') then
    raise exception 'Só locação ativa ou em devolução aceita devolução' using errcode = '22023';
  end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Selecione ao menos um bem ou quantidade de lote' using errcode = '22023';
  end if;
  if p_observacoes is not null and length(p_observacoes) > 4000 then
    raise exception 'Observação muito longa' using errcode = '22023';
  end if;
  insert into public.devolucoes (empresa_id, locacao_id, observacoes)
  values (loc.empresa_id, loc.id, nullif(trim(p_observacoes), ''))
  returning id into v_id;

  for e in select * from jsonb_array_elements(p_itens) loop
    if e ? 'bem' then
      select * into b from public.bens where id = (e->>'bem')::uuid for update;
      if not found or b.empresa_id <> loc.empresa_id
         or not exists (select 1 from public.itens_locacao i where i.id = b.item_locacao_id and i.locacao_id = loc.id) then
        raise exception 'Bem não pertence a esta locação' using errcode = '22023';
      end if;
      if b.status not in ('DISPONIVEL', 'EM_USO') then
        raise exception 'Bem % em situação que não permite devolução (%)', b.codigo, b.status using errcode = '22023';
      end if;
      insert into public.itens_devolucao (empresa_id, devolucao_id, item_locacao_id, bem_id, quantidade_solicitada,
                                          status_anterior_bem)
      values (loc.empresa_id, v_id, b.item_locacao_id, b.id, 1, b.status);
      update public.bens set status = 'DEVOLUCAO_SOLICITADA' where id = b.id;
    elsif e ? 'lote' then
      select * into lt from public.lotes where id = (e->>'lote')::uuid for update;
      if not found or lt.empresa_id <> loc.empresa_id
         or not exists (select 1 from public.itens_locacao i where i.id = lt.item_locacao_id and i.locacao_id = loc.id) then
        raise exception 'Lote não pertence a esta locação' using errcode = '22023';
      end if;
      if lt.status <> 'ATIVO' then
        raise exception 'Lote % sem saldo', lt.codigo using errcode = '22023';
      end if;
      if exists (select 1 from public.movimentacoes m where m.lote_id = lt.id and m.status = 'PENDENTE_ACEITE') then
        raise exception 'Lote % tem movimentação aguardando aceite', lt.codigo using errcode = '22023';
      end if;
      v_disponivel := lt.saldo - privado.reserva_lote(lt.id);
      v_qtd := coalesce((e->>'quantidade')::numeric, v_disponivel);
      if v_qtd <= 0 or v_qtd <> round(v_qtd, 3) or v_qtd > v_disponivel then
        raise exception 'Lote %: quantidade indisponível (disponível para devolução: %)',
          lt.codigo, trim(to_char(v_disponivel, 'FM999999999990.###')) using errcode = '22023';
      end if;
      insert into public.itens_devolucao (empresa_id, devolucao_id, item_locacao_id, lote_id, quantidade_solicitada)
      values (loc.empresa_id, v_id, lt.item_locacao_id, lt.id, v_qtd);
    else
      raise exception 'Item inválido' using errcode = '22023';
    end if;
    v_n := v_n + 1;
  end loop;

  update public.devolucoes set status = 'SOLICITADA', solicitada_em = now(), solicitada_por = (select auth.uid())
   where id = v_id;
  perform privado.registrar_auditoria(loc.empresa_id, 'devolucao.solicitar', 'devolucoes', v_id, null,
    jsonb_build_object('status', 'SOLICITADA', 'itens', v_n), null);

  -- Desmobilização automática quando as devoluções abertas cobrem todo o saldo.
  if loc.status = 'ATIVA' and privado.devolucoes_cobrem_saldo(loc.id) then
    update public.locacoes
       set status = 'EM_DEVOLUCAO', desmobilizacao_iniciada_em = now(),
           desmobilizacao_iniciada_por = (select auth.uid()), desmobilizacao_devolucao_id = v_id
     where id = loc.id;
    perform privado.registrar_auditoria(loc.empresa_id, 'locacao.iniciar_desmobilizacao', 'locacoes', loc.id,
      jsonb_build_object('status', 'ATIVA'), jsonb_build_object('status', 'EM_DEVOLUCAO'),
      jsonb_build_object('automatica', true, 'devolucao', v_id));
  end if;
  return v_id;
end
$$;

-- Agendamento e reagendamento (data anterior preservada na auditoria).
create function public.rpc_agendar_devolucao(p_devolucao uuid, p_agendada_para timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.devolucoes := privado.devolucao_gerenciavel(p_devolucao);
begin
  if d.status not in ('SOLICITADA', 'AGENDADA') then
    raise exception 'Só devolução solicitada ou agendada pode ser (re)agendada' using errcode = '22023';
  end if;
  if p_agendada_para is null or p_agendada_para < d.solicitada_em - interval '1 minute' then
    raise exception 'A data agendada não pode ser anterior à solicitação' using errcode = '22023';
  end if;
  update public.devolucoes
     set status = 'AGENDADA', agendada_para = p_agendada_para, agendada_em = now(), agendada_por = (select auth.uid())
   where id = d.id;
  perform privado.registrar_auditoria(d.empresa_id,
    case when d.status = 'AGENDADA' then 'devolucao.reagendar' else 'devolucao.agendar' end,
    'devolucoes', d.id, jsonb_build_object('status', d.status, 'agendada_para', d.agendada_para),
    jsonb_build_object('status', 'AGENDADA', 'agendada_para', p_agendada_para), null);
end
$$;

-- Vistoria de saída de um item (versão vigente do checklist da categoria).
create function public.rpc_iniciar_vistoria_saida(p_item_devolucao uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  it public.itens_devolucao;
  d public.devolucoes;
  v_familia uuid;
  v_modelo uuid;
  v_id uuid;
begin
  select * into it from public.itens_devolucao where id = p_item_devolucao;
  if not found then
    raise exception 'Item não encontrado' using errcode = 'P0002';
  end if;
  d := privado.devolucao_gerenciavel(it.devolucao_id);
  if not privado.usuario_tem_permissao(d.empresa_id, 'vistoria.registrar') then
    raise exception 'Sem permissão para registrar vistorias' using errcode = '42501';
  end if;
  if d.status not in ('SOLICITADA', 'AGENDADA') or not it.ativo then
    raise exception 'Vistoria de saída só antes da retirada' using errcode = '22023';
  end if;
  select id into v_id from public.vistorias where item_devolucao_id = it.id and status <> 'CANCELADA';
  if v_id is not null then
    return v_id;
  end if;
  select c.checklist_familia_id into v_familia
  from public.itens_locacao i join public.categorias_bem c on c.id = i.categoria_id
  where i.id = it.item_locacao_id;
  if v_familia is null then
    raise exception 'A categoria deste item não tem checklist' using errcode = '22023';
  end if;
  v_modelo := privado.modelo_vigente(d.empresa_id, v_familia);
  if v_modelo is null then
    raise exception 'O checklist da categoria não tem versão publicada' using errcode = '22023';
  end if;
  insert into public.vistorias (empresa_id, tipo, modelo_id, bem_id, lote_id, item_devolucao_id,
                                evento_origem_tipo, evento_origem_id, data_evento)
  values (d.empresa_id, 'SAIDA', v_modelo, it.bem_id, it.lote_id, it.id, 'DEVOLUCAO', d.id, now())
  returning id into v_id;
  return v_id;
end
$$;

-- Confirmação da retirada (RN-53..55). itens = [{"id": item, "quantidade": n, "condicao": "BOM"}].
-- p_imediata: devolução só solicitada registra o agendamento com a mesma data (§4.9).
create function public.rpc_confirmar_retirada(
  p_devolucao uuid,
  p_retirada_em timestamptz,
  p_recebedor text,
  p_itens jsonb,
  p_imediata boolean default false
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.devolucoes := privado.devolucao_gerenciavel(p_devolucao);
  it public.itens_devolucao;
  b public.bens;
  lt public.lotes;
  e jsonb;
  v_qtd numeric;
  v_cond public.condicao_item;
  v_familia uuid;
  v_retirados integer := 0;
  v_ultimo timestamptz;
  v_recebedor text := trim(coalesce(p_recebedor, ''));
  v_status_locacao public.status_locacao;
begin
  if d.status = 'SOLICITADA' and p_imediata then
    update public.devolucoes
       set status = 'AGENDADA', agendada_para = p_retirada_em, agendada_em = now(), agendada_por = (select auth.uid())
     where id = d.id;
    perform privado.registrar_auditoria(d.empresa_id, 'devolucao.agendar', 'devolucoes', d.id,
      jsonb_build_object('status', 'SOLICITADA'), jsonb_build_object('status', 'AGENDADA', 'agendada_para', p_retirada_em),
      jsonb_build_object('retirada_imediata', true));
  elsif d.status <> 'AGENDADA' then
    raise exception 'A retirada exige devolução agendada (ou retirada imediata de devolução solicitada)'
      using errcode = '22023';
  end if;
  if p_retirada_em is null or p_retirada_em > now() + interval '5 minutes' then
    raise exception 'A data da retirada não pode estar no futuro' using errcode = '22023';
  end if;
  if p_retirada_em < d.solicitada_em - interval '1 minute' then
    raise exception 'A retirada não pode ser anterior à solicitação' using errcode = '22023';
  end if;
  if length(v_recebedor) < 2 or length(v_recebedor) > 120 then
    raise exception 'Informe o nome de quem recebeu pelo fornecedor (RN-54)' using errcode = '22023';
  end if;
  if jsonb_typeof(p_itens) <> 'array' then
    raise exception 'Itens inválidos' using errcode = '22023';
  end if;
  -- Cada item ativo precisa de uma decisão explícita (quantidade, mesmo que zero).
  if exists (select 1 from public.itens_devolucao i where i.devolucao_id = d.id and i.ativo
             and not exists (select 1 from jsonb_array_elements(p_itens) x where (x->>'id')::uuid = i.id)) then
    raise exception 'Informe a quantidade retirada de todos os itens' using errcode = '22023';
  end if;

  for e in select * from jsonb_array_elements(p_itens) loop
    select * into it from public.itens_devolucao where id = (e->>'id')::uuid and devolucao_id = d.id and ativo for update;
    if not found then
      raise exception 'Item não pertence a esta devolução' using errcode = '22023';
    end if;
    v_qtd := (e->>'quantidade')::numeric;
    if v_qtd is null or v_qtd < 0 or v_qtd > it.quantidade_solicitada or v_qtd <> round(v_qtd, 3)
       or (it.bem_id is not null and v_qtd not in (0, 1)) then
      raise exception 'Quantidade retirada inválida (0 a %)',
        trim(to_char(it.quantidade_solicitada, 'FM999999999990.###')) using errcode = '22023';
    end if;
    if v_qtd = 0 then
      perform privado.liberar_item_devolucao(it.id);
      update public.itens_devolucao set quantidade_retirada = 0 where id = it.id;
      continue;
    end if;
    v_cond := (e->>'condicao')::public.condicao_item;
    if v_cond is null then
      raise exception 'Informe a condição de saída de cada item retirado' using errcode = '22023';
    end if;
    v_ultimo := privado.ultimo_evento(it.bem_id, it.lote_id);
    if v_ultimo is not null and p_retirada_em < v_ultimo then
      raise exception 'A retirada não pode ser anterior ao último evento do item' using errcode = '22023';
    end if;
    -- RN-54: vistoria de saída concluída quando a categoria tem checklist.
    select c.checklist_familia_id into v_familia
    from public.itens_locacao i join public.categorias_bem c on c.id = i.categoria_id
    where i.id = it.item_locacao_id;
    if v_familia is not null and not exists (
      select 1 from public.vistorias v where v.item_devolucao_id = it.id and v.status = 'CONCLUIDA') then
      raise exception 'Conclua a vistoria de saída de % antes da retirada',
        coalesce((select codigo from public.bens where id = it.bem_id), (select codigo from public.lotes where id = it.lote_id))
        using errcode = '22023';
    end if;
    if it.bem_id is not null then
      select * into b from public.bens where id = it.bem_id for update;
      if b.status <> 'DEVOLUCAO_SOLICITADA' then
        raise exception 'Bem % não pode ser retirado na situação atual (%); informe 0', b.codigo, b.status
          using errcode = '22023';
      end if;
      update public.bens set status = 'DEVOLVIDO' where id = b.id;
    else
      select * into lt from public.lotes where id = it.lote_id for update;
      if lt.status <> 'ATIVO' or v_qtd > lt.saldo then
        raise exception 'Lote % sem saldo para esta retirada', lt.codigo using errcode = '22023';
      end if;
      update public.lotes
         set quantidade_devolvida = quantidade_devolvida + v_qtd,
             status = case when lt.saldo - v_qtd = 0 then 'ENCERRADO' else 'ATIVO' end::public.status_lote
       where id = lt.id;
    end if;
    update public.itens_devolucao set quantidade_retirada = v_qtd, condicao_saida = v_cond where id = it.id;
    v_retirados := v_retirados + 1;
  end loop;

  if v_retirados = 0 then
    raise exception 'Nenhum item retirado: cancele a devolução em vez de confirmar' using errcode = '22023';
  end if;
  update public.devolucoes
     set status = 'RETIRADA_CONFIRMADA', retirada_em = p_retirada_em, retirada_confirmada_em = now(),
         retirada_confirmada_por = (select auth.uid()), fornecedor_recebedor = v_recebedor
   where id = d.id;
  perform privado.registrar_auditoria(d.empresa_id, 'devolucao.confirmar_retirada', 'devolucoes', d.id,
    jsonb_build_object('status', 'AGENDADA'),
    jsonb_build_object('status', 'RETIRADA_CONFIRMADA', 'retirada_em', p_retirada_em, 'itens_retirados', v_retirados),
    null);

  -- Saldo zerado: a locação fica pronta para encerramento operacional e o
  -- financeiro recebe a pendência — NUNCA encerra a cobrança (RN-55).
  select status into v_status_locacao from public.locacoes where id = d.locacao_id;
  if privado.saldo_locacao(d.locacao_id) = 0 and v_status_locacao = 'ATIVA' then
    update public.locacoes
       set status = 'EM_DEVOLUCAO', desmobilizacao_iniciada_em = now(), desmobilizacao_iniciada_por = (select auth.uid())
     where id = d.locacao_id;
  end if;
  perform privado.atualizar_financeiro_por_saldo(d.locacao_id);
end
$$;

-- Conferência: exige comprovante ativo anexado (RN-54, F7.3).
create function public.rpc_conferir_devolucao(p_devolucao uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.devolucoes := privado.devolucao_gerenciavel(p_devolucao);
begin
  if d.status <> 'RETIRADA_CONFIRMADA' then
    raise exception 'Só devolução com retirada confirmada pode ser conferida' using errcode = '22023';
  end if;
  if not exists (select 1 from public.evidencias e where e.entidade_tipo = 'DEVOLUCAO' and e.entidade_id = d.id
                 and e.tipo = 'COMPROVANTE' and e.status = 'ATIVA') then
    raise exception 'Anexe o comprovante de retirada antes de conferir' using errcode = '22023';
  end if;
  update public.devolucoes
     set status = 'CONFERIDA', conferida_em = now(), conferida_por = (select auth.uid()), comprovante_confirmado = true
   where id = d.id;
  perform privado.registrar_auditoria(d.empresa_id, 'devolucao.conferir', 'devolucoes', d.id,
    jsonb_build_object('status', d.status), jsonb_build_object('status', 'CONFERIDA'), null);
end
$$;

-- Cancelamento antes da retirada: bens voltam ao estado anterior; reservas liberadas.
create function public.rpc_cancelar_devolucao(p_devolucao uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.devolucoes := privado.devolucao_gerenciavel(p_devolucao);
  it record;
  loc public.locacoes;
  v_motivo text := trim(coalesce(p_motivo, ''));
begin
  if d.status not in ('RASCUNHO', 'SOLICITADA', 'AGENDADA') then
    raise exception 'Devolução com retirada confirmada não pode ser cancelada' using errcode = '22023';
  end if;
  if length(v_motivo) < 10 then
    raise exception 'Informe o motivo com pelo menos 10 caracteres' using errcode = '22023';
  end if;
  for it in select id from public.itens_devolucao where devolucao_id = d.id and ativo loop
    perform privado.liberar_item_devolucao(it.id);
  end loop;
  update public.devolucoes
     set status = 'CANCELADA', cancelada_em = now(), cancelada_por = (select auth.uid()), motivo_cancelamento = v_motivo
   where id = d.id;
  perform privado.registrar_auditoria(d.empresa_id, 'devolucao.cancelar', 'devolucoes', d.id,
    jsonb_build_object('status', d.status), jsonb_build_object('status', 'CANCELADA'),
    jsonb_build_object('motivo', v_motivo));
  -- D-15: desfaz a desmobilização automática causada por esta devolução.
  select * into loc from public.locacoes where id = d.locacao_id for update;
  if loc.status = 'EM_DEVOLUCAO' and loc.desmobilizacao_devolucao_id = d.id
     and privado.saldo_locacao(loc.id) > 0 and not privado.devolucoes_cobrem_saldo(loc.id) then
    update public.locacoes
       set status = 'ATIVA', desmobilizacao_iniciada_em = null, desmobilizacao_iniciada_por = null,
           desmobilizacao_devolucao_id = null
     where id = loc.id;
    perform privado.registrar_auditoria(loc.empresa_id, 'locacao.reverter_desmobilizacao', 'locacoes', loc.id,
      jsonb_build_object('status', 'EM_DEVOLUCAO'), jsonb_build_object('status', 'ATIVA'),
      jsonb_build_object('devolucao_cancelada', d.id));
  end if;
end
$$;

-- RN-56: ciência financeira da data de término de cobrança dos itens devolvidos.
create function public.rpc_dar_ciencia_devolucao(p_devolucao uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.devolucoes;
begin
  select * into d from public.devolucoes where id = p_devolucao for update;
  if not found or not privado.pode_ler(d.empresa_id) then
    raise exception 'Devolução não encontrada' using errcode = 'P0002';
  end if;
  if not privado.usuario_tem_permissao(d.empresa_id, 'devolucao.ciencia_financeira') then
    raise exception 'Sem permissão para registrar ciência financeira' using errcode = '42501';
  end if;
  if d.retirada_confirmada_em is null then
    raise exception 'Ciência só após a retirada confirmada' using errcode = '22023';
  end if;
  if d.ciencia_financeira_em is not null then
    raise exception 'Ciência já registrada' using errcode = '22023';
  end if;
  update public.devolucoes set ciencia_financeira_em = now(), ciencia_financeira_por = (select auth.uid())
   where id = d.id;
  perform privado.registrar_auditoria(d.empresa_id, 'devolucao.ciencia_financeira', 'devolucoes', d.id,
    null, jsonb_build_object('ciencia_financeira', true), null);
end
$$;

-- --------------------------------------------------------- encerramentos ---
create function public.rpc_iniciar_desmobilizacao(p_locacao uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.locacoes;
begin
  select * into l from public.locacoes where id = p_locacao for update;
  if not found or not privado.pode_ler(l.empresa_id) then
    raise exception 'Locação não encontrada' using errcode = 'P0002';
  end if;
  if not privado.usuario_tem_permissao(l.empresa_id, 'locacao.iniciar_desmobilizacao') then
    raise exception 'Sem permissão para iniciar a desmobilização' using errcode = '42501';
  end if;
  if l.status <> 'ATIVA' then
    raise exception 'Só locação ativa pode iniciar a desmobilização' using errcode = '22023';
  end if;
  update public.locacoes
     set status = 'EM_DEVOLUCAO', desmobilizacao_iniciada_em = now(), desmobilizacao_iniciada_por = (select auth.uid())
   where id = l.id;
  perform privado.registrar_auditoria(l.empresa_id, 'locacao.iniciar_desmobilizacao', 'locacoes', l.id,
    jsonb_build_object('status', 'ATIVA'), jsonb_build_object('status', 'EM_DEVOLUCAO'), null);
end
$$;

-- Pendências do encerramento operacional (RN-60), em linguagem operacional.
create function public.pendencias_encerramento_operacional(p_locacao uuid) returns text[]
language plpgsql stable security definer
set search_path = ''
as $$
declare
  l public.locacoes;
  v text[] := '{}';
  v_bens integer;
  v_lotes numeric;
  v_dev integer;
begin
  select * into l from public.locacoes where id = p_locacao;
  if not found or not privado.pode_ler(l.empresa_id) then
    raise exception 'Locação não encontrada' using errcode = 'P0002';
  end if;
  if l.status <> 'EM_DEVOLUCAO' then
    v := array_append(v, 'A locação precisa estar em devolução');
  end if;
  select count(*) into v_bens from public.bens b join public.itens_locacao i on i.id = b.item_locacao_id
   where i.locacao_id = l.id and public.status_bem_ativo(b.status);
  if v_bens > 0 then
    v := array_append(v, format('%s bem(ns) ainda sob responsabilidade da empresa', v_bens));
  end if;
  select coalesce(sum(lt.saldo), 0) into v_lotes from public.lotes lt join public.itens_locacao i on i.id = lt.item_locacao_id
   where i.locacao_id = l.id and lt.status = 'ATIVO';
  if v_lotes > 0 then
    v := array_append(v, format('Saldo de lotes: %s', trim(to_char(v_lotes, 'FM999999999990.###'))));
  end if;
  select count(*) into v_dev from public.devolucoes d
   where d.locacao_id = l.id and d.status in ('RASCUNHO', 'SOLICITADA', 'AGENDADA');
  if v_dev > 0 then
    v := array_append(v, format('%s devolução(ões) aguardando retirada', v_dev));
  end if;
  return v;
end
$$;

-- RN-60/62: encerramento OPERACIONAL — não toca no status financeiro.
create function public.rpc_encerrar_operacional(p_locacao uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.locacoes;
  v_pend text[];
begin
  select * into l from public.locacoes where id = p_locacao for update;
  if not found or not privado.pode_ler(l.empresa_id) then
    raise exception 'Locação não encontrada' using errcode = 'P0002';
  end if;
  if not privado.usuario_tem_permissao(l.empresa_id, 'locacao.encerrar_operacional') then
    raise exception 'Sem permissão para o encerramento operacional' using errcode = '42501';
  end if;
  v_pend := public.pendencias_encerramento_operacional(p_locacao);
  if cardinality(v_pend) > 0 then
    raise exception 'Encerramento operacional bloqueado: %', array_to_string(v_pend, '; ') using errcode = '22023';
  end if;
  update public.locacoes
     set status = 'ENCERRADA_OPERACIONALMENTE', encerrada_operacional_em = now(),
         encerrada_operacional_por = (select auth.uid())
   where id = l.id;
  perform privado.registrar_auditoria(l.empresa_id, 'locacao.encerrar_operacional', 'locacoes', l.id,
    jsonb_build_object('status', l.status), jsonb_build_object('status', 'ENCERRADA_OPERACIONALMENTE'), null);
end
$$;

-- RN-61/62: encerramento FINANCEIRO com data — não toca no status operacional.
create function public.rpc_encerrar_financeiro(p_locacao uuid, p_data date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.locacoes;
  v_hoje date;
  v_abertas integer;
begin
  select * into l from public.locacoes where id = p_locacao for update;
  if not found or not privado.pode_ler(l.empresa_id) then
    raise exception 'Locação não encontrada' using errcode = 'P0002';
  end if;
  if not privado.usuario_tem_permissao(l.empresa_id, 'locacao.encerrar_financeiro') then
    raise exception 'Sem permissão para o encerramento financeiro' using errcode = '42501';
  end if;
  if l.status_financeiro <> 'ENCERRAMENTO_PENDENTE' then
    raise exception 'Encerramento financeiro só com saldo zerado (encerramento pendente)' using errcode = '22023';
  end if;
  select (now() at time zone e.timezone)::date into v_hoje from public.empresas e where e.id = l.empresa_id;
  if p_data is null or p_data > v_hoje then
    raise exception 'Informe a data do encerramento financeiro (não futura)' using errcode = '22023';
  end if;
  if l.inicio_efetivo is not null and p_data < l.inicio_efetivo then
    raise exception 'A data do encerramento não pode ser anterior ao início da locação' using errcode = '22023';
  end if;
  select count(*) into v_abertas from public.cobrancas c
   where c.locacao_id = l.id and c.status in ('PENDENTE', 'DIVERGENTE');
  if v_abertas > 0 then
    raise exception 'Há % cobrança(s) pendente(s) ou divergente(s)', v_abertas using errcode = '22023';
  end if;
  update public.locacoes
     set status_financeiro = 'ENCERRADO', data_encerramento_financeiro = p_data,
         encerrada_financeiro_em = now(), encerrada_financeiro_por = (select auth.uid())
   where id = l.id;
  perform privado.registrar_auditoria(l.empresa_id, 'locacao.encerrar_financeiro', 'locacoes', l.id,
    jsonb_build_object('status_financeiro', l.status_financeiro),
    jsonb_build_object('status_financeiro', 'ENCERRADO', 'data_encerramento_financeiro', p_data), null);
end
$$;

-- -------------------------------------------------------------- cobranças ---
create function privado.cobranca_gerenciavel(p_cobranca uuid) returns public.cobrancas
language plpgsql security definer
set search_path = ''
as $$
declare
  c public.cobrancas;
begin
  select * into c from public.cobrancas where id = p_cobranca for update;
  if not found or not privado.usuario_tem_permissao(c.empresa_id, 'valores.ver') then
    raise exception 'Cobrança não encontrada' using errcode = 'P0002';
  end if;
  if not privado.usuario_tem_permissao(c.empresa_id, 'cobranca.gerenciar') then
    raise exception 'Sem permissão para gerenciar cobranças' using errcode = '42501';
  end if;
  if exists (select 1 from public.locacoes l where l.id = c.locacao_id and l.status_financeiro = 'ENCERRADO') then
    raise exception 'Locação com encerramento financeiro: cobranças não podem mudar' using errcode = '22023';
  end if;
  return c;
end
$$;

create function public.rpc_registrar_cobranca(
  p_locacao uuid,
  p_competencia_inicio date,
  p_competencia_fim date,
  p_valor numeric,
  p_numero_documento text default null,
  p_observacoes text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.locacoes;
  v_id uuid;
begin
  select * into l from public.locacoes where id = p_locacao for update;
  if not found or not privado.usuario_tem_permissao(l.empresa_id, 'valores.ver') then
    raise exception 'Locação não encontrada' using errcode = 'P0002';
  end if;
  if not privado.usuario_tem_permissao(l.empresa_id, 'cobranca.gerenciar') then
    raise exception 'Sem permissão para registrar cobranças' using errcode = '42501';
  end if;
  if l.status in ('RASCUNHO', 'CANCELADA') then
    raise exception 'Locação sem vigência não recebe cobrança' using errcode = '22023';
  end if;
  if l.status_financeiro = 'ENCERRADO' then
    raise exception 'Locação com encerramento financeiro' using errcode = '22023';
  end if;
  if p_competencia_inicio is null or p_competencia_fim is null or p_competencia_fim < p_competencia_inicio then
    raise exception 'Competência inválida (fim antes do início)' using errcode = '22023';
  end if;
  if p_valor is null or p_valor < 0 or p_valor <> round(p_valor, 2) or p_valor >= 1e12 then
    raise exception 'Valor inválido' using errcode = '22023';
  end if;
  insert into public.cobrancas (empresa_id, locacao_id, competencia_inicio, competencia_fim, valor_cobrado,
                                numero_documento, observacoes)
  values (l.empresa_id, l.id, p_competencia_inicio, p_competencia_fim, p_valor,
          nullif(trim(p_numero_documento), ''), nullif(trim(p_observacoes), ''))
  returning id into v_id;
  perform privado.registrar_auditoria(l.empresa_id, 'cobranca.registrar', 'cobrancas', v_id, null,
    jsonb_build_object('valor', p_valor, 'competencia_inicio', p_competencia_inicio,
                       'competencia_fim', p_competencia_fim), null);
  -- RN-74: a primeira cobrança inicia o ciclo financeiro.
  if l.status_financeiro = 'NAO_INICIADO' then
    update public.locacoes set status_financeiro = 'EM_COBRANCA' where id = l.id;
    perform privado.registrar_auditoria(l.empresa_id, 'financeiro.iniciar_cobranca', 'locacoes', l.id,
      jsonb_build_object('status_financeiro', 'NAO_INICIADO'), jsonb_build_object('status_financeiro', 'EM_COBRANCA'),
      null);
  end if;
  return v_id;
end
$$;

create function public.rpc_conferir_cobranca(p_cobranca uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.cobrancas := privado.cobranca_gerenciavel(p_cobranca);
begin
  if c.status <> 'PENDENTE' then
    raise exception 'Só cobrança pendente pode ser conferida' using errcode = '22023';
  end if;
  update public.cobrancas set status = 'CONFERIDA', conferida_em = now(), conferida_por = (select auth.uid())
   where id = c.id;
  perform privado.registrar_auditoria(c.empresa_id, 'cobranca.conferir', 'cobrancas', c.id,
    jsonb_build_object('status', c.status), jsonb_build_object('status', 'CONFERIDA'), null);
end
$$;

create function public.rpc_marcar_cobranca_divergente(p_cobranca uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.cobrancas := privado.cobranca_gerenciavel(p_cobranca);
  v_motivo text := trim(coalesce(p_motivo, ''));
begin
  if c.status not in ('PENDENTE', 'CONFERIDA') then
    raise exception 'Cobrança nesta situação não pode ser marcada como divergente' using errcode = '22023';
  end if;
  if length(v_motivo) < 10 or length(v_motivo) > 2000 then
    raise exception 'Descreva a divergência com pelo menos 10 caracteres' using errcode = '22023';
  end if;
  update public.cobrancas
     set status = 'DIVERGENTE', motivo_divergencia = v_motivo, divergente_em = now(), divergente_por = (select auth.uid())
   where id = c.id;
  perform privado.registrar_auditoria(c.empresa_id, 'cobranca.divergente', 'cobrancas', c.id,
    jsonb_build_object('status', c.status), jsonb_build_object('status', 'DIVERGENTE'),
    jsonb_build_object('motivo', v_motivo));
end
$$;

create function public.rpc_resolver_cobranca(p_cobranca uuid, p_resolucao text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.cobrancas := privado.cobranca_gerenciavel(p_cobranca);
  v_resolucao text := trim(coalesce(p_resolucao, ''));
begin
  if c.status <> 'DIVERGENTE' then
    raise exception 'Só cobrança divergente pode ser resolvida' using errcode = '22023';
  end if;
  if length(v_resolucao) < 10 or length(v_resolucao) > 2000 then
    raise exception 'Descreva a resolução com pelo menos 10 caracteres' using errcode = '22023';
  end if;
  update public.cobrancas
     set status = 'RESOLVIDA', resolucao = v_resolucao, resolvida_em = now(), resolvida_por = (select auth.uid())
   where id = c.id;
  perform privado.registrar_auditoria(c.empresa_id, 'cobranca.resolver', 'cobrancas', c.id,
    jsonb_build_object('status', c.status), jsonb_build_object('status', 'RESOLVIDA'), null);
end
$$;

-- ------------------------------------------------------------- estimativa ---
-- RN-72/73 (S-04): unidades × dias de posse no período × valor/divisor da
-- periodicidade. Dia comercial no fuso da empresa: conta o dia de início da
-- posse e não o dia em que ela termina (retirada/troca/baixa). Cálculo em
-- numeric; arredondamento só na exibição. NÃO substitui documento fiscal.
create function public.estimativa_locacao(p_locacao uuid, p_inicio date, p_fim date)
returns table (
  item_locacao_id uuid, descricao text, unidade text, periodicidade public.periodicidade,
  valor_unitario text, unidades_dia text, valor_estimado text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  l public.locacoes;
  v_tz text;
begin
  select * into l from public.locacoes where id = p_locacao;
  if not found or not privado.usuario_tem_permissao(l.empresa_id, 'valores.ver') then
    raise exception 'Locação não encontrada' using errcode = 'P0002';
  end if;
  if not privado.usuario_tem_permissao(l.empresa_id, 'cobranca.ver_estimativa') then
    raise exception 'Sem permissão para ver a estimativa' using errcode = '42501';
  end if;
  if p_inicio is null or p_fim is null or p_fim < p_inicio or p_fim - p_inicio > 1830 then
    raise exception 'Período inválido (até 5 anos)' using errcode = '22023';
  end if;
  select timezone into v_tz from public.empresas where id = l.empresa_id;
  return query
  with itens as (
    select i.* from public.itens_locacao i where i.locacao_id = l.id
  ), eventos as (
    -- bem: início da posse (recebimento ou troca)
    select b.item_locacao_id as item,
           coalesce(r.data_evento, (select o.data_evento from public.ocorrencias o
                                    where o.tipo = 'TROCA' and o.bem_substituto_id = b.id limit 1)) as em,
           1::numeric as delta
    from public.bens b join itens i on i.id = b.item_locacao_id
    left join public.recebimentos r on r.id = b.recebimento_id
    where b.status not in ('AGUARDANDO_RECEBIMENTO', 'CANCELADO')
    union all
    -- bem: fim por retirada
    select b.item_locacao_id, d.retirada_em, -1
    from public.bens b join itens i on i.id = b.item_locacao_id
    join public.itens_devolucao it on it.bem_id = b.id and it.quantidade_retirada = 1
    join public.devolucoes d on d.id = it.devolucao_id and d.status in ('RETIRADA_CONFIRMADA', 'CONFERIDA')
    union all
    -- bem: fim por troca ou indenização
    select b.item_locacao_id, case when o.tipo = 'TROCA' then o.data_evento else o.resolvida_em end, -1
    from public.bens b join itens i on i.id = b.item_locacao_id
    join public.ocorrencias o on o.bem_id = b.id and o.status = 'RESOLVIDA'
     and (o.tipo = 'TROCA' or (o.tipo = 'EXTRAVIO' and o.resultado = 'INDENIZADO'))
    union all
    -- lote raiz: quantidade recebida
    select lt.item_locacao_id, r.data_evento, lt.quantidade_recebida
    from public.lotes lt join itens i on i.id = lt.item_locacao_id
    join public.recebimentos r on r.id = lt.recebimento_id
    where lt.lote_origem_id is null and lt.status <> 'CANCELADO'
    union all
    -- lote: retiradas
    select it.item_locacao_id, d.retirada_em, -it.quantidade_retirada
    from public.itens_devolucao it join itens i on i.id = it.item_locacao_id
    join public.devolucoes d on d.id = it.devolucao_id and d.status in ('RETIRADA_CONFIRMADA', 'CONFERIDA')
    where it.lote_id is not null and it.quantidade_retirada > 0
    union all
    -- lote: extravio indenizado
    select lt.item_locacao_id, o.resolvida_em, -o.quantidade
    from public.ocorrencias o join public.lotes lt on lt.id = o.lote_id join itens i on i.id = lt.item_locacao_id
    where o.tipo = 'EXTRAVIO' and o.resultado = 'INDENIZADO' and o.status = 'RESOLVIDA' and o.quantidade is not null
  ), por_dia as (
    select e.item, (e.em at time zone v_tz)::date as dia, sum(e.delta) as delta
    from eventos e where e.em is not null group by 1, 2
  ), saldo as (
    select p.item, p.dia,
           sum(p.delta) over (partition by p.item order by p.dia) as qtd,
           lead(p.dia) over (partition by p.item order by p.dia) as prox
    from por_dia p
  ), segmentos as (
    select s.item, s.qtd,
           greatest(s.dia, p_inicio) as ini,
           least(coalesce(s.prox, p_fim + 1), p_fim + 1) as fim
    from saldo s
  ), total as (
    select g.item, sum(g.qtd * greatest(g.fim - g.ini, 0)) as unidades_dia
    from segmentos g group by g.item
  )
  select i.id, i.descricao, i.unidade, i.periodicidade, i.valor_unitario::text,
         coalesce(t.unidades_dia, 0)::text,
         (coalesce(t.unidades_dia, 0) * i.valor_unitario
           / case i.periodicidade when 'DIARIA' then 1 when 'SEMANAL' then 7
                                  when 'QUINZENAL' then 15 else 30 end)::text
  from itens i left join total t on t.item = i.id
  order by i.descricao;
end
$$;

-- ------------------------------------------- anexos e linha do tempo ---
create or replace function privado.validar_anexo(
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
  -- F7.3: comprovante é o documento da retirada — só na devolução já retirada.
  if p_tipo = 'COMPROVANTE' and (p_entidade_tipo <> 'DEVOLUCAO' or not exists (
      select 1 from public.devolucoes where id = p_entidade_id and status in ('RETIRADA_CONFIRMADA', 'CONFERIDA'))) then
    raise exception 'Comprovante só pode ser anexado à devolução com retirada confirmada' using errcode = '22023';
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


create or replace function public.linha_do_tempo(p_bem uuid default null, p_lote uuid default null)
returns table (em timestamptz, tipo text, titulo text, detalhe text, ref_tipo text, ref_id uuid,
               registrado_em timestamptz)
language sql stable
set search_path = ''
as $$
  -- recebimento
  select r.data_evento, 'RECEBIMENTO', 'Recebido em ' || coalesce(lc.nome, 'local'), r.codigo, 'recebimento', r.id,
         coalesce(r.confirmado_em, r.created_at)
  from public.recebimentos r
  left join public.locais lc on lc.id = r.local_id
  where r.status in ('CONFIRMADO', 'CANCELADO') and r.id = coalesce(
    (select recebimento_id from public.bens where id = p_bem),
    (select recebimento_id from public.lotes where id = p_lote))
  union all
  -- origem por divisão de lote
  select l.created_at, 'DIVISAO', 'Criado por divisão do lote ' || o.codigo, null, 'lote', o.id, l.created_at
  from public.lotes l join public.lotes o on o.id = l.lote_origem_id
  where l.id = p_lote
  union all
  -- movimentações (registro)
  select m.data_evento, 'MOVIMENTACAO',
         case m.status when 'PENDENTE_ACEITE' then 'Transferência aguardando aceite'
                       when 'CONFIRMADA' then 'Movimentação confirmada'
                       when 'RECUSADA' then 'Movimentação recusada'
                       else 'Movimentação cancelada' end
           || ': ' || lo.nome || ' → ' || ld.nome,
         m.codigo || coalesce(' · ' || m.motivo, '')
           || case when m.quantidade is not null then ' · qtd ' || trim(to_char(m.quantidade, 'FM999999999990.###')) else '' end
           || case when m.aceite_administrativo then ' · aceite administrativo' else '' end
           || case when m.corrige_movimentacao_id is not null then ' · correção' else '' end,
         'movimentacao', m.id, m.created_at
  from public.movimentacoes m
  join public.locais lo on lo.id = m.origem_local_id
  join public.locais ld on ld.id = m.destino_local_id
  where m.bem_id = p_bem or m.lote_id = p_lote or m.lote_destino_id = p_lote
  union all
  -- vistorias
  select v.data_evento, 'VISTORIA',
         'Vistoria ' || lower(v.tipo::text) || case v.status when 'CONCLUIDA' then ' concluída' else ' em andamento' end,
         null, 'vistoria', v.id, v.created_at
  from public.vistorias v
  where (v.bem_id = p_bem or v.lote_id = p_lote) and v.status <> 'CANCELADA'
  union all
  -- ocorrências (abertura)
  select o.data_evento, 'OCORRENCIA',
         case when o.tipo = 'TROCA' and o.bem_substituto_id = p_bem then 'Entrou em substituição'
              when o.tipo = 'TROCA' then 'Substituído pelo fornecedor'
              else 'Ocorrência ' || lower(replace(o.tipo::text, '_', ' ')) end,
         o.codigo || ' · ' || o.descricao, 'ocorrencia', o.id, o.created_at
  from public.ocorrencias o
  where o.bem_id = p_bem or o.lote_id = p_lote or o.bem_substituto_id = p_bem
  union all
  -- ocorrências (resolução/cancelamento)
  select coalesce(o.resolvida_em, o.cancelada_em), 'OCORRENCIA_FIM',
         case when o.status = 'CANCELADA' then 'Ocorrência cancelada' else 'Ocorrência resolvida' end
           || coalesce(' (' || lower(o.resultado::text) || ')', ''),
         o.codigo || coalesce(' · ' || coalesce(o.resolucao, o.motivo_cancelamento), ''), 'ocorrencia', o.id,
         coalesce(o.resolvida_em, o.cancelada_em)
  from public.ocorrencias o
  where (o.bem_id = p_bem or o.lote_id = p_lote) and o.tipo <> 'TROCA'
    and (o.resolvida_em is not null or o.cancelada_em is not null)
  union all
  -- devoluções: solicitação (com o item) e desfecho
  select d.solicitada_em, 'DEVOLUCAO', 'Devolução solicitada',
         d.codigo || case when it.lote_id is not null
                          then ' · qtd ' || trim(to_char(it.quantidade_solicitada, 'FM999999999990.###')) else '' end,
         'devolucao', d.id, d.solicitada_em
  from public.itens_devolucao it join public.devolucoes d on d.id = it.devolucao_id
  where (it.bem_id = p_bem or it.lote_id = p_lote) and d.solicitada_em is not null
  union all
  select coalesce(d.retirada_em, d.cancelada_em), 'DEVOLUCAO_FIM',
         case when d.status = 'CANCELADA' then 'Devolução cancelada'
              when it.quantidade_retirada = 0 then 'Não retirado na devolução'
              else 'Retirado pelo fornecedor' end,
         d.codigo || case when it.lote_id is not null and it.quantidade_retirada > 0
                          then ' · qtd ' || trim(to_char(it.quantidade_retirada, 'FM999999999990.###')) else '' end
           || coalesce(' · recebido por ' || d.fornecedor_recebedor, '')
           || coalesce(' · ' || d.motivo_cancelamento, ''),
         'devolucao', d.id, coalesce(d.retirada_confirmada_em, d.cancelada_em)
  from public.itens_devolucao it join public.devolucoes d on d.id = it.devolucao_id
  where (it.bem_id = p_bem or it.lote_id = p_lote)
    and (d.retirada_confirmada_em is not null or d.cancelada_em is not null)
  -- Mesma data do fato (o formulário tem precisão de minuto): vale a ordem de registro.
  order by 1 desc, 7 desc, 2
$$;


-- ------------------------------------------------------------- privilégios --
revoke all on function
  privado.locacao_para_devolucao(uuid), privado.devolucao_gerenciavel(uuid), privado.saldo_locacao(uuid),
  privado.devolucoes_cobrem_saldo(uuid), privado.atualizar_financeiro_por_saldo(uuid),
  privado.liberar_item_devolucao(uuid), privado.cobranca_gerenciavel(uuid)
from public, anon, authenticated;

revoke all on function
  public.rpc_solicitar_devolucao(uuid, jsonb, text),
  public.rpc_agendar_devolucao(uuid, timestamptz),
  public.rpc_iniciar_vistoria_saida(uuid),
  public.rpc_confirmar_retirada(uuid, timestamptz, text, jsonb, boolean),
  public.rpc_conferir_devolucao(uuid),
  public.rpc_cancelar_devolucao(uuid, text),
  public.rpc_dar_ciencia_devolucao(uuid),
  public.rpc_iniciar_desmobilizacao(uuid),
  public.pendencias_encerramento_operacional(uuid),
  public.rpc_encerrar_operacional(uuid),
  public.rpc_encerrar_financeiro(uuid, date),
  public.rpc_registrar_cobranca(uuid, date, date, numeric, text, text),
  public.rpc_conferir_cobranca(uuid),
  public.rpc_marcar_cobranca_divergente(uuid, text),
  public.rpc_resolver_cobranca(uuid, text),
  public.estimativa_locacao(uuid, date, date)
from public, anon;

grant execute on function
  public.rpc_solicitar_devolucao(uuid, jsonb, text),
  public.rpc_agendar_devolucao(uuid, timestamptz),
  public.rpc_iniciar_vistoria_saida(uuid),
  public.rpc_confirmar_retirada(uuid, timestamptz, text, jsonb, boolean),
  public.rpc_conferir_devolucao(uuid),
  public.rpc_cancelar_devolucao(uuid, text),
  public.rpc_dar_ciencia_devolucao(uuid),
  public.rpc_iniciar_desmobilizacao(uuid),
  public.pendencias_encerramento_operacional(uuid),
  public.rpc_encerrar_operacional(uuid),
  public.rpc_encerrar_financeiro(uuid, date),
  public.rpc_registrar_cobranca(uuid, date, date, numeric, text, text),
  public.rpc_conferir_cobranca(uuid),
  public.rpc_marcar_cobranca_divergente(uuid, text),
  public.rpc_resolver_cobranca(uuid, text),
  public.estimativa_locacao(uuid, date, date)
to authenticated;
