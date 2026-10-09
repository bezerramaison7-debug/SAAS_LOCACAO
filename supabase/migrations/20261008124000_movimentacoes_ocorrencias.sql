-- =============================================================================
-- 014 — Fase 6: movimentações (com/sem aceite, divisão de lote, correção),
--        ocorrências (extravio, manutenção, tratamento), troca de bem,
--        vistoria avulsa e linha do tempo.
-- Convenções (D-04): security definer, search_path vazio, empresa derivada da
-- linha-alvo, permissão revalidada, linha travada (for update), auditoria.
-- Invariante (RN-30): local/responsável atuais = último evento confirmado.
-- =============================================================================

-- ------------------------------------------------------------ auxiliares ---
create function privado.papel_atual(p_empresa uuid) returns public.papel_usuario
language sql stable security definer
set search_path = ''
as $$
  select papel from public.usuarios_empresa
  where empresa_id = p_empresa and user_id = (select auth.uid()) and ativo
$$;

-- RN-32 + nota 2 de permissions.md: responsável é membro ativo e não AUDITOR.
create function privado.validar_responsavel(p_empresa uuid, p_usuario uuid) returns void
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.usuarios_empresa
                 where empresa_id = p_empresa and user_id = p_usuario and ativo and papel <> 'AUDITOR') then
    raise exception 'Responsável inválido: precisa ser usuário ativo da empresa (auditor não recebe itens)'
      using errcode = '22023';
  end if;
end
$$;

create function privado.validar_local(p_empresa uuid, p_local uuid) returns void
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.locais where id = p_local and empresa_id = p_empresa and ativo) then
    raise exception 'Local inexistente ou inativo' using errcode = '22023';
  end if;
end
$$;

-- Data do último evento confirmado do bem/lote (recebimento, divisão ou movimentação).
create function privado.ultimo_evento(p_bem uuid, p_lote uuid) returns timestamptz
language sql stable security definer
set search_path = ''
as $$
  select greatest(
    (select max(m.data_evento) from public.movimentacoes m
     where m.status = 'CONFIRMADA' and (m.bem_id = p_bem or m.lote_id = p_lote or m.lote_destino_id = p_lote)),
    (select r.data_evento from public.bens b join public.recebimentos r on r.id = b.recebimento_id where b.id = p_bem),
    (select r.data_evento from public.lotes l join public.recebimentos r on r.id = l.recebimento_id where l.id = p_lote),
    (select o.data_evento from public.ocorrencias o where o.tipo = 'TROCA' and o.bem_substituto_id = p_bem)
  )
$$;

-- Quantidade do lote reservada por devoluções em aberto (RN-52).
create function privado.reserva_lote(p_lote uuid) returns numeric
language sql stable security definer
set search_path = ''
as $$
  select coalesce(sum(i.quantidade_solicitada - coalesce(i.quantidade_retirada, 0)), 0)
  from public.itens_devolucao i join public.devolucoes d on d.id = i.devolucao_id
  where i.lote_id = p_lote and i.ativo and d.status in ('RASCUNHO', 'SOLICITADA', 'AGENDADA')
$$;

-- ---------------------------------------------------------- movimentação ---
-- Aplica o deslocamento (bem ou lote) e devolve o lote destino (divisão — RN-34).
create function privado.aplicar_movimentacao(
  p_bem uuid, p_lote uuid, p_quantidade numeric, p_destino uuid, p_responsavel uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.lotes;
  v_filho uuid;
begin
  if p_bem is not null then
    -- Alocar ou concluir transferência: o bem passa a estar EM_USO no destino.
    update public.bens
       set local_atual_id = p_destino, responsavel_atual_id = p_responsavel, status = 'EM_USO'
     where id = p_bem;
    return null;
  end if;
  select * into l from public.lotes where id = p_lote for update;
  if l.status <> 'ATIVO' or p_quantidade > l.saldo then
    raise exception 'Saldo do lote insuficiente para a movimentação' using errcode = '22023';
  end if;
  if p_quantidade = l.saldo then
    update public.lotes set local_atual_id = p_destino, responsavel_atual_id = p_responsavel where id = l.id;
    return l.id;
  end if;
  insert into public.lotes (empresa_id, item_locacao_id, lote_origem_id, quantidade_recebida,
                            local_atual_id, responsavel_atual_id)
  values (l.empresa_id, l.item_locacao_id, l.id, p_quantidade, p_destino, p_responsavel)
  returning id into v_filho;
  update public.lotes set quantidade_dividida = quantidade_dividida + p_quantidade where id = l.id;
  return v_filho;
end
$$;

create function public.rpc_registrar_movimentacao(
  p_destino_local uuid,
  p_novo_responsavel uuid,
  p_data_evento timestamptz,
  p_motivo text,
  p_bem uuid default null,
  p_lote uuid default null,
  p_quantidade numeric default null,
  p_corrige uuid default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.bens;
  l public.lotes;
  v_empresa uuid;
  v_origem uuid;
  v_resp_anterior uuid;
  v_exige_aceite boolean;
  v_pendente boolean;
  v_quantidade numeric;
  v_destino_lote uuid;
  v_id uuid;
  v_ultimo timestamptz;
  v_motivo text := trim(coalesce(p_motivo, ''));
  v_uid uuid := (select auth.uid());
begin
  if (p_bem is null) = (p_lote is null) then
    raise exception 'Informe um bem ou um lote' using errcode = '22023';
  end if;
  if p_bem is not null then
    select * into b from public.bens where id = p_bem for update;
    v_empresa := b.empresa_id;
  else
    select * into l from public.lotes where id = p_lote for update;
    v_empresa := l.empresa_id;
  end if;
  if v_empresa is null or not privado.pode_ler(v_empresa) then
    raise exception 'Bem ou lote não encontrado' using errcode = 'P0002';
  end if;
  if not privado.usuario_tem_permissao(v_empresa, 'movimentacao.registrar') then
    raise exception 'Sem permissão para registrar movimentações' using errcode = '42501';
  end if;
  perform privado.validar_local(v_empresa, p_destino_local);
  perform privado.validar_responsavel(v_empresa, p_novo_responsavel);
  if p_data_evento is null or p_data_evento > now() + interval '5 minutes' then
    raise exception 'A data da movimentação não pode estar no futuro' using errcode = '22023';
  end if;
  v_ultimo := privado.ultimo_evento(p_bem, p_lote);
  if v_ultimo is not null and p_data_evento < v_ultimo then
    -- Mantém a ordem dos fatos: o cache sempre reflete o evento mais recente (RN-30).
    raise exception 'A data deve ser igual ou posterior ao último evento (%)',
      to_char(v_ultimo at time zone (select timezone from public.empresas where id = v_empresa), 'DD/MM/YYYY HH24:MI')
      using errcode = '22023';
  end if;
  if length(v_motivo) < 3 then
    raise exception 'Informe o motivo da movimentação' using errcode = '22023';
  end if;
  if exists (select 1 from public.movimentacoes m
             where m.status = 'PENDENTE_ACEITE' and (m.bem_id = p_bem or m.lote_id = p_lote)) then
    raise exception 'Há uma movimentação aguardando aceite para este item (RN-35)' using errcode = '22023';
  end if;
  if p_corrige is not null then
    if not exists (select 1 from public.movimentacoes m where m.id = p_corrige and m.status = 'CONFIRMADA'
                   and m.empresa_id = v_empresa and (m.bem_id = p_bem or m.lote_id = p_lote or m.lote_destino_id = p_lote)) then
      raise exception 'A correção deve referenciar uma movimentação confirmada deste item' using errcode = '22023';
    end if;
    if length(v_motivo) < 10 then
      raise exception 'Correção exige motivo com pelo menos 10 caracteres' using errcode = '22023';
    end if;
  end if;

  if p_bem is not null then
    if b.status not in ('DISPONIVEL', 'EM_USO') then
      raise exception 'Bem em situação que não permite movimentação (%)', b.status using errcode = '22023';
    end if;
    v_origem := b.local_atual_id;
    v_resp_anterior := b.responsavel_atual_id;
  else
    if l.status <> 'ATIVO' then
      raise exception 'Lote sem saldo para movimentar' using errcode = '22023';
    end if;
    v_quantidade := coalesce(p_quantidade, l.saldo - privado.reserva_lote(l.id));
    if v_quantidade <= 0 or v_quantidade <> round(v_quantidade, 3)
       or v_quantidade > l.saldo - privado.reserva_lote(l.id) then
      raise exception 'Quantidade indisponível: saldo % menos % reservado em devoluções',
        l.saldo, privado.reserva_lote(l.id) using errcode = '22023';
    end if;
    v_origem := l.local_atual_id;
    v_resp_anterior := l.responsavel_atual_id;
  end if;
  if v_origem = p_destino_local and v_resp_anterior = p_novo_responsavel then
    raise exception 'Informe outro local ou outro responsável' using errcode = '22023';
  end if;

  -- RN-33: aceite só quando a empresa exige e a responsabilidade passa para outra pessoa.
  select exige_aceite_movimentacao into v_exige_aceite from public.empresas where id = v_empresa;
  v_pendente := v_exige_aceite and p_novo_responsavel <> v_resp_anterior and p_novo_responsavel <> v_uid;

  if v_pendente then
    if p_bem is not null then
      update public.bens set status = 'EM_USO' where id = p_bem and status = 'DISPONIVEL';
      update public.bens set status = 'EM_TRANSFERENCIA' where id = p_bem;
    end if;
  else
    v_destino_lote := privado.aplicar_movimentacao(p_bem, p_lote, v_quantidade, p_destino_local, p_novo_responsavel);
  end if;

  insert into public.movimentacoes (empresa_id, bem_id, lote_id, quantidade, lote_destino_id, origem_local_id,
    destino_local_id, responsavel_anterior_id, novo_responsavel_id, data_evento, motivo, status, confirmada_em,
    corrige_movimentacao_id)
  values (v_empresa, p_bem, p_lote, v_quantidade, v_destino_lote, v_origem, p_destino_local, v_resp_anterior,
          p_novo_responsavel, p_data_evento, v_motivo,
          case when v_pendente then 'PENDENTE_ACEITE' else 'CONFIRMADA' end::public.status_movimentacao,
          case when v_pendente then null else now() end, p_corrige)
  returning id into v_id;
  perform privado.registrar_auditoria(
    v_empresa, 'movimentacao.registrar', 'movimentacoes', v_id, null,
    jsonb_build_object('pendente_aceite', v_pendente, 'destino', p_destino_local, 'responsavel', p_novo_responsavel),
    case when p_corrige is not null then jsonb_build_object('corrige', p_corrige) end);
  return v_id;
end
$$;

-- Aceite pelo novo responsável, ou aceite administrativo (ADMIN, com justificativa).
create function public.rpc_aceitar_movimentacao(p_movimentacao uuid, p_justificativa text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.movimentacoes;
  v_uid uuid := (select auth.uid());
  v_admin boolean;
  v_destino_lote uuid;
  v_just text := nullif(trim(coalesce(p_justificativa, '')), '');
begin
  select * into m from public.movimentacoes where id = p_movimentacao for update;
  if not found or not privado.usuario_pertence_empresa(m.empresa_id) then
    raise exception 'Movimentação não encontrada' using errcode = 'P0002';
  end if;
  if m.status <> 'PENDENTE_ACEITE' then
    raise exception 'Esta movimentação não aguarda aceite' using errcode = '22023';
  end if;
  v_admin := privado.papel_atual(m.empresa_id) = 'ADMIN';
  if m.novo_responsavel_id = v_uid then
    if not privado.usuario_tem_permissao(m.empresa_id, 'movimentacao.aceitar') then
      raise exception 'Sem permissão para aceitar movimentações' using errcode = '42501';
    end if;
    v_just := null;
  elsif v_admin then
    if v_just is null or length(v_just) < 10 then
      raise exception 'Aceite administrativo exige justificativa com pelo menos 10 caracteres' using errcode = '22023';
    end if;
  else
    raise exception 'Somente o novo responsável (ou um administrador) pode aceitar' using errcode = '42501';
  end if;
  if m.bem_id is not null then
    perform 1 from public.bens where id = m.bem_id and status = 'EM_TRANSFERENCIA' for update;
    if not found then
      raise exception 'O bem não está mais em transferência' using errcode = '22023';
    end if;
  end if;
  v_destino_lote := privado.aplicar_movimentacao(m.bem_id, m.lote_id, m.quantidade, m.destino_local_id,
                                                 m.novo_responsavel_id);
  update public.movimentacoes
     set status = 'CONFIRMADA', confirmada_em = now(), aceita_por = v_uid, lote_destino_id = v_destino_lote,
         aceite_administrativo = v_just is not null, justificativa_aceite_administrativo = v_just
   where id = m.id;
  perform privado.registrar_auditoria(
    m.empresa_id, case when v_just is null then 'movimentacao.aceitar' else 'movimentacao.aceite_administrativo' end,
    'movimentacoes', m.id, jsonb_build_object('status', m.status), jsonb_build_object('status', 'CONFIRMADA'),
    case when v_just is not null then jsonb_build_object('justificativa', v_just) end);
end
$$;

-- Recusa pelo destinatário: nada muda no local/responsável (o bem volta a EM_USO na origem).
create function public.rpc_recusar_movimentacao(p_movimentacao uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.movimentacoes;
  v_uid uuid := (select auth.uid());
  v_motivo text := trim(coalesce(p_motivo, ''));
begin
  select * into m from public.movimentacoes where id = p_movimentacao for update;
  if not found or not privado.usuario_pertence_empresa(m.empresa_id) then
    raise exception 'Movimentação não encontrada' using errcode = 'P0002';
  end if;
  if m.status <> 'PENDENTE_ACEITE' then
    raise exception 'Esta movimentação não aguarda aceite' using errcode = '22023';
  end if;
  if m.novo_responsavel_id <> v_uid or not privado.usuario_tem_permissao(m.empresa_id, 'movimentacao.aceitar') then
    raise exception 'Somente o novo responsável pode recusar' using errcode = '42501';
  end if;
  if length(v_motivo) < 3 then
    raise exception 'Informe o motivo da recusa' using errcode = '22023';
  end if;
  if m.bem_id is not null then
    update public.bens set status = 'EM_USO' where id = m.bem_id and status = 'EM_TRANSFERENCIA';
  end if;
  update public.movimentacoes
     set status = 'RECUSADA', recusada_em = now(), recusada_por = v_uid, motivo_recusa = v_motivo
   where id = m.id;
  perform privado.registrar_auditoria(
    m.empresa_id, 'movimentacao.recusar', 'movimentacoes', m.id, jsonb_build_object('status', m.status),
    jsonb_build_object('status', 'RECUSADA'), jsonb_build_object('motivo', v_motivo));
end
$$;

-- Cancelamento de pendente: autor da movimentação ou ADMIN.
create function public.rpc_cancelar_movimentacao(p_movimentacao uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.movimentacoes;
  v_uid uuid := (select auth.uid());
  v_motivo text := trim(coalesce(p_motivo, ''));
begin
  select * into m from public.movimentacoes where id = p_movimentacao for update;
  if not found or not privado.pode_ler(m.empresa_id) then
    raise exception 'Movimentação não encontrada' using errcode = 'P0002';
  end if;
  if m.status <> 'PENDENTE_ACEITE' then
    raise exception 'Somente movimentações aguardando aceite podem ser canceladas' using errcode = '22023';
  end if;
  if not ((m.created_by = v_uid and privado.usuario_tem_permissao(m.empresa_id, 'movimentacao.registrar'))
          or privado.papel_atual(m.empresa_id) = 'ADMIN') then
    raise exception 'Somente o autor ou um administrador pode cancelar' using errcode = '42501';
  end if;
  if length(v_motivo) < 10 then
    raise exception 'Informe o motivo com pelo menos 10 caracteres' using errcode = '22023';
  end if;
  if m.bem_id is not null then
    update public.bens set status = 'EM_USO' where id = m.bem_id and status = 'EM_TRANSFERENCIA';
  end if;
  update public.movimentacoes set status = 'CANCELADA', cancelada_em = now(), cancelada_por = v_uid where id = m.id;
  perform privado.registrar_auditoria(
    m.empresa_id, 'movimentacao.cancelar', 'movimentacoes', m.id, jsonb_build_object('status', m.status),
    jsonb_build_object('status', 'CANCELADA'), jsonb_build_object('motivo', v_motivo));
end
$$;

-- ------------------------------------------------------------ ocorrências ---
create function public.rpc_registrar_ocorrencia(
  p_tipo public.tipo_ocorrencia,
  p_descricao text,
  p_data_evento timestamptz,
  p_bem uuid default null,
  p_lote uuid default null,
  p_locacao uuid default null,
  p_prioridade public.prioridade default 'MEDIA',
  p_prazo timestamptz default null,
  p_quantidade numeric default null,
  p_manutencao boolean default false
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.bens;
  l public.lotes;
  v_empresa uuid;
  v_locacao uuid := p_locacao;
  v_anterior public.status_bem;
  v_id uuid;
  v_papel public.papel_usuario;
  m record;
begin
  if p_bem is not null and p_lote is not null then
    raise exception 'Informe um bem ou um lote, não ambos' using errcode = '22023';
  end if;
  if p_tipo = 'TROCA' then
    raise exception 'Troca é registrada pela ação de troca do bem' using errcode = '22023';
  end if;
  if p_bem is not null then
    select * into b from public.bens where id = p_bem for update;
    v_empresa := b.empresa_id;
    select i.locacao_id into v_locacao from public.itens_locacao i where i.id = b.item_locacao_id;
  elsif p_lote is not null then
    select * into l from public.lotes where id = p_lote for update;
    v_empresa := l.empresa_id;
    select i.locacao_id into v_locacao from public.itens_locacao i where i.id = l.item_locacao_id;
  else
    select empresa_id into v_empresa from public.locacoes where id = p_locacao;
  end if;
  if v_empresa is null or not privado.usuario_pertence_empresa(v_empresa)
     or not (privado.pode_ler(v_empresa) or privado.ve_bem(p_bem) or privado.ve_lote(p_lote)) then
    raise exception 'Registro não encontrado' using errcode = 'P0002';
  end if;
  if not privado.usuario_tem_permissao(v_empresa, 'ocorrencia.registrar') then
    raise exception 'Sem permissão para registrar ocorrências' using errcode = '42501';
  end if;
  v_papel := privado.papel_atual(v_empresa);
  if v_papel = 'FINANCEIRO' and p_tipo <> 'DIVERGENCIA_DOCUMENTAL' then
    raise exception 'Financeiro registra apenas divergência documental' using errcode = '42501';
  end if;
  if p_data_evento is null or p_data_evento > now() + interval '5 minutes' then
    raise exception 'A data da ocorrência não pode estar no futuro' using errcode = '22023';
  end if;

  if p_tipo = 'EXTRAVIO' then
    if p_bem is null and p_lote is null then
      raise exception 'Extravio exige o bem ou o lote' using errcode = '22023';
    end if;
    if p_bem is not null then
      if b.status not in ('DISPONIVEL', 'EM_USO', 'EM_TRANSFERENCIA', 'EM_MANUTENCAO', 'DEVOLUCAO_SOLICITADA') then
        raise exception 'Bem em situação que não permite registrar extravio (%)', b.status using errcode = '22023';
      end if;
      v_anterior := b.status;
      -- Transferência pendente perde o objeto: é cancelada automaticamente.
      for m in select id from public.movimentacoes where bem_id = p_bem and status = 'PENDENTE_ACEITE' loop
        update public.movimentacoes set status = 'CANCELADA', cancelada_em = now(), cancelada_por = (select auth.uid())
         where id = m.id;
        v_anterior := 'EM_USO';
      end loop;
      update public.bens set status = 'EXTRAVIADO' where id = p_bem;
    else
      if p_quantidade is null or p_quantidade <= 0 or p_quantidade > l.saldo then
        raise exception 'Informe a quantidade extraviada (até o saldo do lote)' using errcode = '22023';
      end if;
    end if;
  elsif p_manutencao then
    if p_tipo not in ('DEFEITO', 'AVARIA') or p_bem is null then
      raise exception 'Manutenção vale para defeito ou avaria de um bem' using errcode = '22023';
    end if;
    if b.status not in ('DISPONIVEL', 'EM_USO') then
      raise exception 'Bem em situação que não permite enviar para manutenção (%)', b.status using errcode = '22023';
    end if;
    if exists (select 1 from public.movimentacoes where bem_id = p_bem and status = 'PENDENTE_ACEITE') then
      raise exception 'Há uma movimentação aguardando aceite para este bem' using errcode = '22023';
    end if;
    v_anterior := b.status;
    update public.bens set status = 'EM_MANUTENCAO' where id = p_bem;
  end if;

  insert into public.ocorrencias (empresa_id, locacao_id, bem_id, lote_id, tipo, descricao, prioridade, prazo,
                                  data_evento, quantidade, status_anterior_bem)
  values (v_empresa, v_locacao, p_bem, p_lote, p_tipo, trim(p_descricao), p_prioridade, p_prazo, p_data_evento,
          p_quantidade, v_anterior)
  returning id into v_id;
  perform privado.registrar_auditoria(
    v_empresa, 'ocorrencia.registrar', 'ocorrencias', v_id, null,
    jsonb_build_object('tipo', p_tipo, 'status_bem', case when v_anterior is not null then
      (select status from public.bens where id = p_bem) end), null);
  return v_id;
end
$$;

create function privado.ocorrencia_tratavel(p_ocorrencia uuid) returns public.ocorrencias
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.ocorrencias;
begin
  select * into o from public.ocorrencias where id = p_ocorrencia for update;
  if not found or not privado.pode_ler(o.empresa_id) then
    raise exception 'Ocorrência não encontrada' using errcode = 'P0002';
  end if;
  if not privado.usuario_tem_permissao(o.empresa_id, 'ocorrencia.tratar') then
    raise exception 'Sem permissão para tratar ocorrências' using errcode = '42501';
  end if;
  return o;
end
$$;

create function public.rpc_tratar_ocorrencia(
  p_ocorrencia uuid, p_responsavel uuid default null, p_prazo timestamptz default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.ocorrencias := privado.ocorrencia_tratavel(p_ocorrencia);
begin
  if o.status not in ('ABERTA', 'EM_TRATAMENTO') then
    raise exception 'Ocorrência encerrada' using errcode = '22023';
  end if;
  if p_responsavel is not null then
    perform privado.validar_responsavel(o.empresa_id, p_responsavel);
  end if;
  update public.ocorrencias
     set status = 'EM_TRATAMENTO', responsavel_id = coalesce(p_responsavel, responsavel_id),
         prazo = coalesce(p_prazo, prazo)
   where id = o.id;
  perform privado.registrar_auditoria(
    o.empresa_id, 'ocorrencia.tratar', 'ocorrencias', o.id, jsonb_build_object('status', o.status),
    jsonb_build_object('status', 'EM_TRATAMENTO', 'responsavel_id', p_responsavel, 'prazo', p_prazo), null);
end
$$;

create function public.rpc_resolver_ocorrencia(
  p_ocorrencia uuid, p_resultado public.resultado_ocorrencia, p_resolucao text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.ocorrencias := privado.ocorrencia_tratavel(p_ocorrencia);
  v_status public.status_bem;
  v_resolucao text := trim(coalesce(p_resolucao, ''));
  l public.lotes;
begin
  if o.status not in ('ABERTA', 'EM_TRATAMENTO') then
    raise exception 'Somente ocorrências abertas ou em tratamento podem ser resolvidas' using errcode = '22023';
  end if;
  if length(v_resolucao) < 10 then
    raise exception 'Descreva a resolução com pelo menos 10 caracteres' using errcode = '22023';
  end if;
  if o.tipo = 'EXTRAVIO' and p_resultado not in ('ENCONTRADO', 'INDENIZADO') then
    raise exception 'Extravio é resolvido como encontrado ou indenizado' using errcode = '22023';
  end if;
  if p_resultado = 'SUBSTITUIDO' then
    raise exception 'Substituição é registrada pela ação de troca do bem' using errcode = '22023';
  end if;
  if o.bem_id is not null and o.status_anterior_bem is not null then
    select status into v_status from public.bens where id = o.bem_id for update;
    if o.tipo = 'EXTRAVIO' and v_status = 'EXTRAVIADO' then
      update public.bens
         set status = case when p_resultado = 'INDENIZADO' then 'BAIXADO'::public.status_bem
                           -- Transferência foi cancelada no extravio: volta em uso na origem.
                           when o.status_anterior_bem = 'EM_TRANSFERENCIA' then 'EM_USO'::public.status_bem
                           else o.status_anterior_bem end
       where id = o.bem_id;
    elsif o.tipo <> 'EXTRAVIO' and v_status = 'EM_MANUTENCAO' then
      update public.bens set status = o.status_anterior_bem where id = o.bem_id;
    end if;
  elsif o.lote_id is not null and o.tipo = 'EXTRAVIO' and p_resultado = 'INDENIZADO' then
    select * into l from public.lotes where id = o.lote_id for update;
    if o.quantidade > l.saldo then
      raise exception 'Saldo do lote menor que a quantidade extraviada' using errcode = '22023';
    end if;
    update public.lotes
       set quantidade_baixada = quantidade_baixada + o.quantidade,
           status = case when l.saldo - o.quantidade = 0 then 'ENCERRADO'::public.status_lote else status end
     where id = o.lote_id;
  end if;
  update public.ocorrencias
     set status = 'RESOLVIDA', resultado = p_resultado, resolucao = v_resolucao, resolvida_em = now(),
         resolvida_por = (select auth.uid())
   where id = o.id;
  perform privado.registrar_auditoria(
    o.empresa_id, 'ocorrencia.resolver', 'ocorrencias', o.id, jsonb_build_object('status', o.status),
    jsonb_build_object('status', 'RESOLVIDA', 'resultado', p_resultado), jsonb_build_object('resolucao', v_resolucao));
end
$$;

-- Reabertura só de ocorrências sem efeito no estado do bem/lote (RN-41); as
-- demais exigem nova ocorrência, para não reescrever a história do item.
create function public.rpc_reabrir_ocorrencia(p_ocorrencia uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.ocorrencias := privado.ocorrencia_tratavel(p_ocorrencia);
  v_motivo text := trim(coalesce(p_motivo, ''));
begin
  if o.status <> 'RESOLVIDA' then
    raise exception 'Somente ocorrências resolvidas podem ser reabertas' using errcode = '22023';
  end if;
  if o.status_anterior_bem is not null or o.tipo in ('TROCA', 'EXTRAVIO') then
    raise exception 'Esta ocorrência alterou a situação do item; registre uma nova ocorrência' using errcode = '22023';
  end if;
  if length(v_motivo) < 10 then
    raise exception 'Informe o motivo com pelo menos 10 caracteres' using errcode = '22023';
  end if;
  update public.ocorrencias
     set status = 'ABERTA', resolvida_em = null, resolvida_por = null, reaberta_em = now(),
         reaberta_por = (select auth.uid()), motivo_reabertura = v_motivo
   where id = o.id;
  perform privado.registrar_auditoria(
    o.empresa_id, 'ocorrencia.reabrir', 'ocorrencias', o.id, jsonb_build_object('status', o.status),
    jsonb_build_object('status', 'ABERTA'), jsonb_build_object('motivo', v_motivo));
end
$$;

-- Cancelamento desfaz o efeito no bem (extraviado/manutenção → estado anterior).
create function public.rpc_cancelar_ocorrencia(p_ocorrencia uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.ocorrencias := privado.ocorrencia_tratavel(p_ocorrencia);
  v_motivo text := trim(coalesce(p_motivo, ''));
  v_status public.status_bem;
begin
  if o.status not in ('ABERTA', 'EM_TRATAMENTO') then
    raise exception 'Somente ocorrências abertas ou em tratamento podem ser canceladas' using errcode = '22023';
  end if;
  if length(v_motivo) < 10 then
    raise exception 'Informe o motivo com pelo menos 10 caracteres' using errcode = '22023';
  end if;
  if o.bem_id is not null and o.status_anterior_bem is not null then
    select status into v_status from public.bens where id = o.bem_id for update;
    if (o.tipo = 'EXTRAVIO' and v_status = 'EXTRAVIADO') or (o.tipo <> 'EXTRAVIO' and v_status = 'EM_MANUTENCAO') then
      update public.bens
         set status = case when o.status_anterior_bem = 'EM_TRANSFERENCIA' then 'EM_USO'::public.status_bem
                           else o.status_anterior_bem end
       where id = o.bem_id;
    end if;
  end if;
  update public.ocorrencias
     set status = 'CANCELADA', cancelada_em = now(), cancelada_por = (select auth.uid()), motivo_cancelamento = v_motivo
   where id = o.id;
  perform privado.registrar_auditoria(
    o.empresa_id, 'ocorrencia.cancelar', 'ocorrencias', o.id, jsonb_build_object('status', o.status),
    jsonb_build_object('status', 'CANCELADA'), jsonb_build_object('motivo', v_motivo));
end
$$;

-- -------------------------------------------------------------- troca -----
-- RN-42: antigo → SUBSTITUIDO; novo bem no mesmo item, herda local e
-- responsável e recebe vistoria de entrada própria (rascunho).
create function public.rpc_trocar_bem(
  p_bem uuid,
  p_motivo text,
  p_data_evento timestamptz,
  p_numero_serie text default null,
  p_placa text default null,
  p_identificacao_fornecedor text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.bens;
  c public.categorias_bem;
  v_locacao uuid;
  v_novo uuid;
  v_motivo text := trim(coalesce(p_motivo, ''));
  v_modelo uuid;
  v_ocorrencia uuid;
  v_serie text := nullif(trim(p_numero_serie), '');
  v_placa text := nullif(trim(p_placa), '');
  v_ident text := nullif(trim(p_identificacao_fornecedor), '');
begin
  select * into b from public.bens where id = p_bem for update;
  if not found or not privado.pode_ler(b.empresa_id) then
    raise exception 'Bem não encontrado' using errcode = 'P0002';
  end if;
  if not privado.usuario_tem_permissao(b.empresa_id, 'troca.registrar') then
    raise exception 'Sem permissão para registrar troca' using errcode = '42501';
  end if;
  if b.status not in ('DISPONIVEL', 'EM_USO', 'EM_MANUTENCAO') then
    raise exception 'Bem em situação que não permite troca (%)', b.status using errcode = '22023';
  end if;
  if exists (select 1 from public.movimentacoes where bem_id = p_bem and status = 'PENDENTE_ACEITE') then
    raise exception 'Há uma movimentação aguardando aceite para este bem' using errcode = '22023';
  end if;
  if length(v_motivo) < 10 then
    raise exception 'Descreva o motivo da troca com pelo menos 10 caracteres' using errcode = '22023';
  end if;
  if p_data_evento is null or p_data_evento > now() + interval '5 minutes' then
    raise exception 'A data da troca não pode estar no futuro' using errcode = '22023';
  end if;
  select c2.* into c from public.itens_locacao i join public.categorias_bem c2 on c2.id = i.categoria_id
  where i.id = b.item_locacao_id;
  select locacao_id into v_locacao from public.itens_locacao where id = b.item_locacao_id;
  if (c.exige_numero_serie and v_serie is null) or (c.exige_placa and v_placa is null)
     or (c.exige_ident_fornecedor and v_ident is null) then
    raise exception 'Informe a identificação do novo bem exigida pela categoria' using errcode = '22023';
  end if;
  -- É proibido "transformar" o antigo no novo: identificação igual é recusada.
  if (v_serie is not null and v_serie = b.numero_serie) or (v_placa is not null and v_placa = b.placa) then
    raise exception 'A identificação do novo bem deve ser diferente da do bem substituído' using errcode = '22023';
  end if;

  insert into public.bens (empresa_id, item_locacao_id, substitui_bem_id, numero_serie, placa, identificacao_fornecedor,
                           status, local_atual_id, responsavel_atual_id)
  values (b.empresa_id, b.item_locacao_id, b.id, v_serie, v_placa, v_ident,
          case when b.status = 'EM_USO' then 'EM_USO'::public.status_bem else 'DISPONIVEL'::public.status_bem end,
          b.local_atual_id, b.responsavel_atual_id)
  returning id into v_novo;
  update public.bens set status = 'SUBSTITUIDO' where id = b.id;

  insert into public.ocorrencias (empresa_id, locacao_id, bem_id, bem_substituto_id, tipo, descricao, prioridade,
                                  status, data_evento, resultado, resolucao, resolvida_em, resolvida_por)
  values (b.empresa_id, v_locacao, b.id, v_novo, 'TROCA', v_motivo, 'MEDIA', 'RESOLVIDA', p_data_evento,
          'SUBSTITUIDO', v_motivo, now(), (select auth.uid()))
  returning id into v_ocorrencia;

  if c.checklist_familia_id is not null then
    v_modelo := privado.modelo_vigente(b.empresa_id, c.checklist_familia_id);
    if v_modelo is not null then
      insert into public.vistorias (empresa_id, tipo, modelo_id, bem_id, evento_origem_tipo, evento_origem_id, data_evento)
      values (b.empresa_id, 'ENTRADA', v_modelo, v_novo, 'OCORRENCIA', v_ocorrencia, p_data_evento);
    end if;
  end if;
  perform privado.registrar_auditoria(
    b.empresa_id, 'bem.trocar', 'bens', b.id, jsonb_build_object('status', b.status),
    jsonb_build_object('status', 'SUBSTITUIDO', 'substituto', v_novo), jsonb_build_object('motivo', v_motivo));
  return v_novo;
end
$$;

-- ------------------------------------------------------ vistoria avulsa ----
-- Vistoria periódica (F6.8) de bem ou lote com a versão vigente do checklist.
create function public.rpc_iniciar_vistoria(p_tipo public.tipo_vistoria, p_bem uuid default null, p_lote uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa uuid;
  v_item uuid;
  v_familia uuid;
  v_modelo uuid;
  v_id uuid;
begin
  if p_tipo <> 'PERIODICA' then
    raise exception 'Vistoria de entrada e de saída nascem do recebimento, da troca ou da devolução' using errcode = '22023';
  end if;
  if (p_bem is null) = (p_lote is null) then
    raise exception 'Informe um bem ou um lote' using errcode = '22023';
  end if;
  if p_bem is not null then
    select empresa_id, item_locacao_id into v_empresa, v_item from public.bens
    where id = p_bem and public.status_bem_ativo(status);
  else
    select empresa_id, item_locacao_id into v_empresa, v_item from public.lotes where id = p_lote and status = 'ATIVO';
  end if;
  if v_empresa is null or not privado.pode_ler(v_empresa) then
    raise exception 'Bem ou lote não encontrado (ou fora de uso)' using errcode = 'P0002';
  end if;
  if not privado.usuario_tem_permissao(v_empresa, 'vistoria.registrar') then
    raise exception 'Sem permissão para registrar vistorias' using errcode = '42501';
  end if;
  select id into v_id from public.vistorias
  where status = 'RASCUNHO' and tipo = p_tipo and (bem_id = p_bem or lote_id = p_lote);
  if v_id is not null then
    return v_id;
  end if;
  select c.checklist_familia_id into v_familia
  from public.itens_locacao i join public.categorias_bem c on c.id = i.categoria_id where i.id = v_item;
  v_modelo := privado.modelo_vigente(v_empresa, v_familia);
  if v_modelo is null then
    raise exception 'A categoria não tem checklist publicado' using errcode = '22023';
  end if;
  insert into public.vistorias (empresa_id, tipo, modelo_id, bem_id, lote_id, data_evento)
  values (v_empresa, p_tipo, v_modelo, p_bem, p_lote, now())
  returning id into v_id;
  return v_id;
end
$$;

-- Conclui vistoria avulsa ou de entrada do substituto (as do recebimento
-- concluem na confirmação). RN-83: obrigatórias e fotos exigidas.
create function public.rpc_concluir_vistoria(p_vistoria uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.vistorias;
  v_pendencias text[];
begin
  select * into v from public.vistorias where id = p_vistoria for update;
  if not found or not privado.pode_ler(v.empresa_id) then
    raise exception 'Vistoria não encontrada' using errcode = 'P0002';
  end if;
  if not privado.usuario_tem_permissao(v.empresa_id, 'vistoria.registrar') then
    raise exception 'Sem permissão para registrar vistorias' using errcode = '42501';
  end if;
  if v.status <> 'RASCUNHO' then
    raise exception 'Vistoria já finalizada' using errcode = '22023';
  end if;
  if v.item_recebimento_id is not null then
    raise exception 'Vistoria de recebimento é concluída na confirmação do recebimento' using errcode = '22023';
  end if;
  v_pendencias := privado.pendencias_vistoria(v.id);
  if cardinality(v_pendencias) > 0 then
    raise exception 'Vistoria incompleta: %', array_to_string(v_pendencias, '; ') using errcode = '22023';
  end if;
  update public.vistorias set status = 'CONCLUIDA', concluida_em = now() where id = v.id;
  perform privado.registrar_auditoria(
    v.empresa_id, 'vistoria.concluir', 'vistorias', v.id, jsonb_build_object('status', v.status),
    jsonb_build_object('status', 'CONCLUIDA'), null);
end
$$;

create function public.pendencias_vistoria(p_vistoria uuid) returns text[]
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_empresa uuid;
begin
  select empresa_id into v_empresa from public.vistorias where id = p_vistoria;
  if v_empresa is null or not privado.pode_ler(v_empresa) then
    raise exception 'Vistoria não encontrada' using errcode = 'P0002';
  end if;
  return privado.pendencias_vistoria(p_vistoria);
end
$$;

-- ---------------------------------------------------------- linha do tempo --
-- Eventos do bem/lote, lidos com a RLS de quem consulta (security invoker).
create function public.linha_do_tempo(p_bem uuid default null, p_lote uuid default null)
returns table (em timestamptz, tipo text, titulo text, detalhe text, ref_tipo text, ref_id uuid)
language sql stable
set search_path = ''
as $$
  -- recebimento
  select r.data_evento, 'RECEBIMENTO', 'Recebido em ' || coalesce(lc.nome, 'local'), r.codigo, 'recebimento', r.id
  from public.recebimentos r
  left join public.locais lc on lc.id = r.local_id
  where r.status in ('CONFIRMADO', 'CANCELADO') and r.id = coalesce(
    (select recebimento_id from public.bens where id = p_bem),
    (select recebimento_id from public.lotes where id = p_lote))
  union all
  -- origem por divisão de lote
  select l.created_at, 'DIVISAO', 'Criado por divisão do lote ' || o.codigo, null, 'lote', o.id
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
         'movimentacao', m.id
  from public.movimentacoes m
  join public.locais lo on lo.id = m.origem_local_id
  join public.locais ld on ld.id = m.destino_local_id
  where m.bem_id = p_bem or m.lote_id = p_lote or m.lote_destino_id = p_lote
  union all
  -- vistorias
  select v.data_evento, 'VISTORIA',
         'Vistoria ' || lower(v.tipo::text) || case v.status when 'CONCLUIDA' then ' concluída' else ' em andamento' end,
         null, 'vistoria', v.id
  from public.vistorias v
  where (v.bem_id = p_bem or v.lote_id = p_lote) and v.status <> 'CANCELADA'
  union all
  -- ocorrências (abertura)
  select o.data_evento, 'OCORRENCIA',
         case when o.tipo = 'TROCA' and o.bem_substituto_id = p_bem then 'Entrou em substituição'
              when o.tipo = 'TROCA' then 'Substituído pelo fornecedor'
              else 'Ocorrência ' || lower(replace(o.tipo::text, '_', ' ')) end,
         o.codigo || ' · ' || o.descricao, 'ocorrencia', o.id
  from public.ocorrencias o
  where o.bem_id = p_bem or o.lote_id = p_lote or o.bem_substituto_id = p_bem
  union all
  -- ocorrências (resolução/cancelamento)
  select coalesce(o.resolvida_em, o.cancelada_em), 'OCORRENCIA_FIM',
         case when o.status = 'CANCELADA' then 'Ocorrência cancelada' else 'Ocorrência resolvida' end
           || coalesce(' (' || lower(o.resultado::text) || ')', ''),
         o.codigo || coalesce(' · ' || coalesce(o.resolucao, o.motivo_cancelamento), ''), 'ocorrencia', o.id
  from public.ocorrencias o
  where (o.bem_id = p_bem or o.lote_id = p_lote) and o.tipo <> 'TROCA'
    and (o.resolvida_em is not null or o.cancelada_em is not null)
  order by 1 desc, 2
$$;

-- --------------------------------------------- recebimento: responsável ---
-- Mesma regra da movimentação: AUDITOR não pode ser responsável por itens.
create or replace function privado.pendencias_recebimento_interno(p_recebimento uuid) returns text[]
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
                    where empresa_id = r.empresa_id and user_id = r.responsavel_id and ativo
                      and papel <> 'AUDITOR') then
    v := array_append(v, 'O responsável precisa ser usuário ativo da empresa (auditor não recebe itens)');
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

-- ---------------------------------------------------------------- grants ----
revoke all on function
  privado.papel_atual(uuid), privado.validar_responsavel(uuid, uuid), privado.validar_local(uuid, uuid),
  privado.ultimo_evento(uuid, uuid), privado.reserva_lote(uuid),
  privado.aplicar_movimentacao(uuid, uuid, numeric, uuid, uuid), privado.ocorrencia_tratavel(uuid)
from public, anon, authenticated;

revoke all on function
  public.rpc_registrar_movimentacao(uuid, uuid, timestamptz, text, uuid, uuid, numeric, uuid),
  public.rpc_aceitar_movimentacao(uuid, text),
  public.rpc_recusar_movimentacao(uuid, text),
  public.rpc_cancelar_movimentacao(uuid, text),
  public.rpc_registrar_ocorrencia(public.tipo_ocorrencia, text, timestamptz, uuid, uuid, uuid, public.prioridade,
                                  timestamptz, numeric, boolean),
  public.rpc_tratar_ocorrencia(uuid, uuid, timestamptz),
  public.rpc_resolver_ocorrencia(uuid, public.resultado_ocorrencia, text),
  public.rpc_reabrir_ocorrencia(uuid, text),
  public.rpc_cancelar_ocorrencia(uuid, text),
  public.rpc_trocar_bem(uuid, text, timestamptz, text, text, text),
  public.rpc_iniciar_vistoria(public.tipo_vistoria, uuid, uuid),
  public.rpc_concluir_vistoria(uuid),
  public.pendencias_vistoria(uuid),
  public.linha_do_tempo(uuid, uuid)
from public, anon;

grant execute on function
  public.rpc_registrar_movimentacao(uuid, uuid, timestamptz, text, uuid, uuid, numeric, uuid),
  public.rpc_aceitar_movimentacao(uuid, text),
  public.rpc_recusar_movimentacao(uuid, text),
  public.rpc_cancelar_movimentacao(uuid, text),
  public.rpc_registrar_ocorrencia(public.tipo_ocorrencia, text, timestamptz, uuid, uuid, uuid, public.prioridade,
                                  timestamptz, numeric, boolean),
  public.rpc_tratar_ocorrencia(uuid, uuid, timestamptz),
  public.rpc_resolver_ocorrencia(uuid, public.resultado_ocorrencia, text),
  public.rpc_reabrir_ocorrencia(uuid, text),
  public.rpc_cancelar_ocorrencia(uuid, text),
  public.rpc_trocar_bem(uuid, text, timestamptz, text, text, text),
  public.rpc_iniciar_vistoria(public.tipo_vistoria, uuid, uuid),
  public.rpc_concluir_vistoria(uuid),
  public.pendencias_vistoria(uuid),
  public.linha_do_tempo(uuid, uuid)
to authenticated;
