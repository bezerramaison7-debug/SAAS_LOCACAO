-- =============================================================================
-- 005 — Eventos operacionais: vistorias, movimentações, ocorrências,
--        devoluções e cobranças. `data_evento` (fato) ≠ `created_at` (registro).
-- =============================================================================

create table public.vistorias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  tipo public.tipo_vistoria not null,
  -- Versão exata do checklist, congelada (RN-81).
  modelo_id uuid not null,
  bem_id uuid,
  lote_id uuid,
  evento_origem_tipo public.entidade_evidencia,
  evento_origem_id uuid,
  data_evento timestamptz not null,
  realizada_por uuid not null default auth.uid(),
  status public.status_vistoria not null default 'RASCUNHO',
  observacao text check (observacao is null or length(observacao) <= 2000),
  concluida_em timestamptz,
  cancelada_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  unique (empresa_id, id),
  foreign key (empresa_id, modelo_id) references public.modelos_checklist (empresa_id, id),
  foreign key (empresa_id, bem_id) references public.bens (empresa_id, id),
  foreign key (empresa_id, lote_id) references public.lotes (empresa_id, id),
  foreign key (empresa_id, realizada_por) references public.usuarios_empresa (empresa_id, user_id),
  check ((bem_id is null) <> (lote_id is null)),
  check ((evento_origem_tipo is null) = (evento_origem_id is null)),
  check (tipo <> 'ENTRADA' or evento_origem_tipo in ('RECEBIMENTO', 'OCORRENCIA')),
  check (tipo <> 'SAIDA' or evento_origem_tipo = 'DEVOLUCAO'),
  check (tipo <> 'OCORRENCIA' or evento_origem_tipo = 'OCORRENCIA'),
  check ((status = 'CONCLUIDA') = (concluida_em is not null)),
  check ((status = 'CANCELADA') = (cancelada_em is not null))
);
create index vistorias_bem_idx on public.vistorias (empresa_id, bem_id);
create index vistorias_lote_idx on public.vistorias (empresa_id, lote_id);
create index vistorias_modelo_idx on public.vistorias (empresa_id, modelo_id);
create index vistorias_realizada_por_idx on public.vistorias (empresa_id, realizada_por);
create index vistorias_origem_idx on public.vistorias (empresa_id, evento_origem_tipo, evento_origem_id);
create index vistorias_status_idx on public.vistorias (empresa_id, status);

create table public.respostas_vistoria (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  vistoria_id uuid not null,
  pergunta_id uuid not null,
  resposta_json jsonb not null,
  observacao text check (observacao is null or length(observacao) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  unique (empresa_id, id),
  unique (vistoria_id, pergunta_id),
  foreign key (empresa_id, vistoria_id) references public.vistorias (empresa_id, id),
  foreign key (empresa_id, pergunta_id) references public.perguntas_checklist (empresa_id, id)
);
create index respostas_vistoria_vistoria_idx on public.respostas_vistoria (empresa_id, vistoria_id);
create index respostas_vistoria_pergunta_idx on public.respostas_vistoria (empresa_id, pergunta_id);

create table public.movimentacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  codigo text not null,
  bem_id uuid,
  lote_id uuid,
  -- Movimentação parcial de lote: quantidade movida e lote filho criado (D-11).
  quantidade numeric(14, 3) check (quantidade is null or quantidade > 0),
  lote_destino_id uuid,
  origem_local_id uuid not null,
  destino_local_id uuid not null,
  responsavel_anterior_id uuid not null,
  novo_responsavel_id uuid not null,
  data_evento timestamptz not null,
  motivo text not null check (length(trim(motivo)) between 3 and 1000),
  status public.status_movimentacao not null,
  confirmada_em timestamptz,
  aceita_por uuid references auth.users (id),
  aceite_administrativo boolean not null default false,
  justificativa_aceite_administrativo text,
  recusada_em timestamptz,
  recusada_por uuid references auth.users (id),
  motivo_recusa text,
  cancelada_em timestamptz,
  cancelada_por uuid references auth.users (id),
  corrige_movimentacao_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  unique (empresa_id, id),
  unique (empresa_id, codigo),
  foreign key (empresa_id, bem_id) references public.bens (empresa_id, id),
  foreign key (empresa_id, lote_id) references public.lotes (empresa_id, id),
  foreign key (empresa_id, lote_destino_id) references public.lotes (empresa_id, id),
  foreign key (empresa_id, origem_local_id) references public.locais (empresa_id, id),
  foreign key (empresa_id, destino_local_id) references public.locais (empresa_id, id),
  foreign key (empresa_id, responsavel_anterior_id) references public.usuarios_empresa (empresa_id, user_id),
  foreign key (empresa_id, novo_responsavel_id) references public.usuarios_empresa (empresa_id, user_id),
  foreign key (empresa_id, corrige_movimentacao_id) references public.movimentacoes (empresa_id, id),
  check ((bem_id is null) <> (lote_id is null)),
  check (bem_id is null or (quantidade is null and lote_destino_id is null)),
  check (lote_id is null or quantidade is not null),
  -- Precisa mudar algo: local e/ou responsável.
  check (origem_local_id <> destino_local_id or responsavel_anterior_id <> novo_responsavel_id),
  check ((status = 'CONFIRMADA') = (confirmada_em is not null)),
  check ((status = 'RECUSADA') = (recusada_em is not null)),
  check (status <> 'RECUSADA' or length(trim(coalesce(motivo_recusa, ''))) >= 3),
  check ((status = 'CANCELADA') = (cancelada_em is not null)),
  check (not aceite_administrativo or length(trim(coalesce(justificativa_aceite_administrativo, ''))) >= 10)
);
create index movimentacoes_bem_idx on public.movimentacoes (empresa_id, bem_id);
create index movimentacoes_lote_idx on public.movimentacoes (empresa_id, lote_id);
create index movimentacoes_lote_destino_idx on public.movimentacoes (empresa_id, lote_destino_id);
create index movimentacoes_origem_idx on public.movimentacoes (empresa_id, origem_local_id);
create index movimentacoes_destino_idx on public.movimentacoes (empresa_id, destino_local_id);
create index movimentacoes_resp_ant_idx on public.movimentacoes (empresa_id, responsavel_anterior_id);
create index movimentacoes_novo_resp_idx on public.movimentacoes (empresa_id, novo_responsavel_id);
create index movimentacoes_corrige_idx on public.movimentacoes (empresa_id, corrige_movimentacao_id);
create index movimentacoes_pendentes_idx on public.movimentacoes (empresa_id, novo_responsavel_id)
  where status = 'PENDENTE_ACEITE';
-- Um bem/lote só pode ter uma movimentação aguardando aceite (RN-35).
create unique index movimentacoes_pendente_bem_uk on public.movimentacoes (bem_id)
  where status = 'PENDENTE_ACEITE' and bem_id is not null;
create unique index movimentacoes_pendente_lote_uk on public.movimentacoes (lote_id)
  where status = 'PENDENTE_ACEITE' and lote_id is not null;

create table public.ocorrencias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  codigo text not null,
  locacao_id uuid not null,
  bem_id uuid,
  lote_id uuid,
  recebimento_id uuid,
  tipo public.tipo_ocorrencia not null,
  descricao text not null check (length(trim(descricao)) between 10 and 4000),
  prioridade public.prioridade not null default 'MEDIA',
  status public.status_ocorrencia not null default 'ABERTA',
  responsavel_id uuid,
  prazo timestamptz,
  data_evento timestamptz not null,
  quantidade numeric(14, 3) check (quantidade is null or quantidade > 0),
  status_anterior_bem public.status_bem,
  bem_substituto_id uuid,
  resultado public.resultado_ocorrencia,
  resolucao text,
  resolvida_em timestamptz,
  resolvida_por uuid references auth.users (id),
  reaberta_em timestamptz,
  reaberta_por uuid references auth.users (id),
  motivo_reabertura text,
  cancelada_em timestamptz,
  cancelada_por uuid references auth.users (id),
  motivo_cancelamento text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  unique (empresa_id, id),
  unique (empresa_id, codigo),
  foreign key (empresa_id, locacao_id) references public.locacoes (empresa_id, id),
  foreign key (empresa_id, bem_id) references public.bens (empresa_id, id),
  foreign key (empresa_id, lote_id) references public.lotes (empresa_id, id),
  foreign key (empresa_id, recebimento_id) references public.recebimentos (empresa_id, id),
  foreign key (empresa_id, bem_substituto_id) references public.bens (empresa_id, id),
  foreign key (empresa_id, responsavel_id) references public.usuarios_empresa (empresa_id, user_id),
  check (not (bem_id is not null and lote_id is not null)),
  check (bem_substituto_id is null or (tipo = 'TROCA' and bem_id is not null)),
  check ((status = 'RESOLVIDA') = (resolvida_em is not null)),
  check (status <> 'RESOLVIDA' or (resultado is not null and length(trim(coalesce(resolucao, ''))) >= 10)),
  check ((reaberta_em is null) or length(trim(coalesce(motivo_reabertura, ''))) >= 10),
  check ((status = 'CANCELADA') = (cancelada_em is not null)),
  check (status <> 'CANCELADA' or length(trim(coalesce(motivo_cancelamento, ''))) >= 10)
);
create index ocorrencias_locacao_idx on public.ocorrencias (empresa_id, locacao_id);
create index ocorrencias_bem_idx on public.ocorrencias (empresa_id, bem_id);
create index ocorrencias_lote_idx on public.ocorrencias (empresa_id, lote_id);
create index ocorrencias_recebimento_idx on public.ocorrencias (empresa_id, recebimento_id);
create index ocorrencias_substituto_idx on public.ocorrencias (empresa_id, bem_substituto_id);
create index ocorrencias_responsavel_idx on public.ocorrencias (empresa_id, responsavel_id);
create index ocorrencias_status_idx on public.ocorrencias (empresa_id, status);
create index ocorrencias_prazo_idx on public.ocorrencias (empresa_id, prazo)
  where status in ('ABERTA', 'EM_TRATAMENTO');

create table public.devolucoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  codigo text not null,
  locacao_id uuid not null,
  status public.status_devolucao not null default 'RASCUNHO',
  solicitada_em timestamptz,
  solicitada_por uuid references auth.users (id),
  agendada_para timestamptz,
  agendada_em timestamptz,
  agendada_por uuid references auth.users (id),
  retirada_em timestamptz,
  retirada_confirmada_em timestamptz,
  retirada_confirmada_por uuid references auth.users (id),
  fornecedor_recebedor text,
  conferida_em timestamptz,
  conferida_por uuid references auth.users (id),
  comprovante_confirmado boolean not null default false,
  ciencia_financeira_em timestamptz,
  ciencia_financeira_por uuid references auth.users (id),
  cancelada_em timestamptz,
  cancelada_por uuid references auth.users (id),
  motivo_cancelamento text,
  observacoes text check (observacoes is null or length(observacoes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  unique (empresa_id, id),
  unique (empresa_id, codigo),
  foreign key (empresa_id, locacao_id) references public.locacoes (empresa_id, id),
  check (status not in ('SOLICITADA', 'AGENDADA', 'RETIRADA_CONFIRMADA', 'CONFERIDA') or solicitada_em is not null),
  check (status not in ('AGENDADA', 'RETIRADA_CONFIRMADA', 'CONFERIDA') or agendada_para is not null),
  -- RN-54: retirada confirmada exige data e nome de quem recebeu pelo fornecedor.
  check ((status in ('RETIRADA_CONFIRMADA', 'CONFERIDA')) = (retirada_confirmada_em is not null)),
  check (retirada_confirmada_em is null
         or (retirada_em is not null and length(trim(coalesce(fornecedor_recebedor, ''))) >= 2)),
  check ((status = 'CONFERIDA') = (conferida_em is not null)),
  check (ciencia_financeira_em is null or retirada_confirmada_em is not null),
  check ((ciencia_financeira_em is null) = (ciencia_financeira_por is null)),
  check ((status = 'CANCELADA') = (cancelada_em is not null)),
  check (status <> 'CANCELADA' or length(trim(coalesce(motivo_cancelamento, ''))) >= 10)
);
create index devolucoes_locacao_idx on public.devolucoes (empresa_id, locacao_id);
create index devolucoes_status_idx on public.devolucoes (empresa_id, status);
create index devolucoes_sem_ciencia_idx on public.devolucoes (empresa_id)
  where retirada_confirmada_em is not null and ciencia_financeira_em is null;

create table public.itens_devolucao (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  devolucao_id uuid not null,
  item_locacao_id uuid not null,
  bem_id uuid,
  lote_id uuid,
  quantidade_solicitada numeric(14, 3) not null check (quantidade_solicitada > 0),
  quantidade_retirada numeric(14, 3) check (quantidade_retirada is null or quantidade_retirada >= 0),
  condicao_saida public.condicao_item,
  status_anterior_bem public.status_bem,
  -- false quando a devolução é cancelada ou o item não foi retirado.
  ativo boolean not null default true,
  observacao text check (observacao is null or length(observacao) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  unique (empresa_id, id),
  foreign key (empresa_id, devolucao_id) references public.devolucoes (empresa_id, id),
  foreign key (empresa_id, item_locacao_id) references public.itens_locacao (empresa_id, id),
  foreign key (empresa_id, bem_id) references public.bens (empresa_id, id),
  foreign key (empresa_id, lote_id) references public.lotes (empresa_id, id),
  check ((bem_id is null) <> (lote_id is null)),
  check (bem_id is null or quantidade_solicitada = 1),
  check (quantidade_retirada is null or quantidade_retirada <= quantidade_solicitada)
);
-- RN-57: um bem não pode estar em duas devoluções não canceladas.
create unique index itens_devolucao_bem_ativo_uk on public.itens_devolucao (bem_id)
  where bem_id is not null and ativo;
create unique index itens_devolucao_lote_por_devolucao_uk on public.itens_devolucao (devolucao_id, lote_id)
  where lote_id is not null;
create index itens_devolucao_devolucao_idx on public.itens_devolucao (empresa_id, devolucao_id);
create index itens_devolucao_item_idx on public.itens_devolucao (empresa_id, item_locacao_id);
create index itens_devolucao_bem_idx on public.itens_devolucao (empresa_id, bem_id);
create index itens_devolucao_lote_idx on public.itens_devolucao (empresa_id, lote_id);

create table public.cobrancas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  codigo text not null,
  locacao_id uuid not null,
  competencia_inicio date not null,
  competencia_fim date not null,
  valor_cobrado numeric(14, 2) not null check (valor_cobrado >= 0),
  numero_documento text check (numero_documento is null or length(trim(numero_documento)) between 1 and 60),
  status public.status_cobranca not null default 'PENDENTE',
  motivo_divergencia text,
  resolucao text,
  conferida_em timestamptz,
  conferida_por uuid references auth.users (id),
  divergente_em timestamptz,
  divergente_por uuid references auth.users (id),
  resolvida_em timestamptz,
  resolvida_por uuid references auth.users (id),
  observacoes text check (observacoes is null or length(observacoes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  unique (empresa_id, id),
  unique (empresa_id, codigo),
  foreign key (empresa_id, locacao_id) references public.locacoes (empresa_id, id),
  check (competencia_fim >= competencia_inicio),
  check (status <> 'CONFERIDA' or conferida_em is not null),
  check (status not in ('DIVERGENTE', 'RESOLVIDA')
         or (divergente_em is not null and length(trim(coalesce(motivo_divergencia, ''))) >= 10)),
  check ((status = 'RESOLVIDA') = (resolvida_em is not null)),
  check (status <> 'RESOLVIDA' or length(trim(coalesce(resolucao, ''))) >= 10)
);
create index cobrancas_locacao_idx on public.cobrancas (empresa_id, locacao_id);
create index cobrancas_status_idx on public.cobrancas (empresa_id, status);
