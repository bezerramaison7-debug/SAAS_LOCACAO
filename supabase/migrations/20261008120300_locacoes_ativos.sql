-- =============================================================================
-- 004 — Locações, referências externas (Sectra), itens contratados,
--        recebimentos, bens (individuais) e lotes.
-- =============================================================================

create table public.locacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  codigo text not null,
  fornecedor_id uuid,
  centro_custo_id uuid,
  status public.status_locacao not null default 'RASCUNHO',
  status_financeiro public.status_financeiro not null default 'NAO_INICIADO',
  inicio_previsto date,
  inicio_efetivo date,
  termino_previsto date,
  observacoes text check (observacoes is null or length(observacoes) <= 4000),
  ativada_em timestamptz,
  ativada_por uuid references auth.users (id),
  desmobilizacao_iniciada_em timestamptz,
  desmobilizacao_iniciada_por uuid references auth.users (id),
  encerrada_operacional_em timestamptz,
  encerrada_operacional_por uuid references auth.users (id),
  data_encerramento_financeiro date,
  encerrada_financeiro_em timestamptz,
  encerrada_financeiro_por uuid references auth.users (id),
  cancelada_em timestamptz,
  cancelada_por uuid references auth.users (id),
  motivo_cancelamento text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  unique (empresa_id, id),
  unique (empresa_id, codigo),
  foreign key (empresa_id, fornecedor_id) references public.fornecedores (empresa_id, id),
  foreign key (empresa_id, centro_custo_id) references public.centros_custo (empresa_id, id),
  check (termino_previsto is null or inicio_previsto is null or termino_previsto >= inicio_previsto),
  -- Fora do rascunho/cancelamento a locação está completa (RN-13).
  check (
    status in ('RASCUNHO', 'CANCELADA')
    or (fornecedor_id is not null and centro_custo_id is not null
        and inicio_previsto is not null and termino_previsto is not null and ativada_em is not null)
  ),
  check ((status = 'CANCELADA') = (cancelada_em is not null)),
  check (status <> 'CANCELADA' or length(trim(coalesce(motivo_cancelamento, ''))) >= 10),
  check ((status = 'ENCERRADA_OPERACIONALMENTE') = (encerrada_operacional_em is not null)),
  -- Encerramento financeiro é um evento próprio, com data informada (RN-61).
  check ((status_financeiro = 'ENCERRADO') = (encerrada_financeiro_em is not null)),
  check ((status_financeiro = 'ENCERRADO') = (data_encerramento_financeiro is not null))
);
create index locacoes_status_idx on public.locacoes (empresa_id, status);
create index locacoes_status_fin_idx on public.locacoes (empresa_id, status_financeiro);
create index locacoes_termino_idx on public.locacoes (empresa_id, termino_previsto)
  where status in ('ATIVA', 'EM_DEVOLUCAO');
create index locacoes_fornecedor_idx on public.locacoes (empresa_id, fornecedor_id);
create index locacoes_centro_custo_idx on public.locacoes (empresa_id, centro_custo_id);
create index locacoes_codigo_trgm on public.locacoes using gin (codigo extensions.gin_trgm_ops);

create table public.referencias_externas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  locacao_id uuid not null,
  sistema public.sistema_externo not null default 'SECTRA',
  tipo public.tipo_referencia not null,
  numero text not null check (length(trim(numero)) between 1 and 60),
  data_documento date,
  observacao text check (observacao is null or length(observacao) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  unique (empresa_id, id),
  -- S-02: um documento externo pertence a uma única locação na empresa.
  unique (empresa_id, sistema, tipo, numero),
  foreign key (empresa_id, locacao_id) references public.locacoes (empresa_id, id)
);
create index referencias_externas_locacao_idx on public.referencias_externas (empresa_id, locacao_id);
create index referencias_externas_numero_trgm
  on public.referencias_externas using gin (numero extensions.gin_trgm_ops);

create table public.itens_locacao (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  locacao_id uuid not null,
  categoria_id uuid not null,
  descricao text not null check (length(trim(descricao)) between 2 and 300),
  -- Herdado da categoria e congelado (RN-11) por trigger.
  modo_controle public.modo_controle not null,
  quantidade_contratada numeric(14, 3) not null check (quantidade_contratada > 0),
  unidade text not null default 'un' check (length(trim(unidade)) between 1 and 20),
  valor_unitario numeric(14, 2) not null check (valor_unitario >= 0),
  periodicidade public.periodicidade not null,
  observacao text check (observacao is null or length(observacao) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  unique (empresa_id, id),
  foreign key (empresa_id, locacao_id) references public.locacoes (empresa_id, id),
  foreign key (empresa_id, categoria_id) references public.categorias_bem (empresa_id, id),
  check (modo_controle = 'LOTE' or quantidade_contratada = trunc(quantidade_contratada))
);
create index itens_locacao_locacao_idx on public.itens_locacao (empresa_id, locacao_id);
create index itens_locacao_categoria_idx on public.itens_locacao (empresa_id, categoria_id);

create table public.recebimentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  codigo text not null,
  locacao_id uuid not null,
  status public.status_recebimento not null default 'RASCUNHO',
  data_evento timestamptz,
  recebido_por uuid,
  local_id uuid,
  responsavel_id uuid,
  observacoes text check (observacoes is null or length(observacoes) <= 4000),
  excesso_justificativa text,
  excesso_autorizado_por uuid,
  excesso_autorizado_em timestamptz,
  confirmado_em timestamptz,
  confirmado_por uuid references auth.users (id),
  cancelado_em timestamptz,
  cancelado_por uuid references auth.users (id),
  motivo_cancelamento text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  unique (empresa_id, id),
  unique (empresa_id, codigo),
  foreign key (empresa_id, locacao_id) references public.locacoes (empresa_id, id),
  foreign key (empresa_id, local_id) references public.locais (empresa_id, id),
  foreign key (empresa_id, recebido_por) references public.usuarios_empresa (empresa_id, user_id),
  foreign key (empresa_id, responsavel_id) references public.usuarios_empresa (empresa_id, user_id),
  foreign key (empresa_id, excesso_autorizado_por) references public.usuarios_empresa (empresa_id, user_id),
  check ((status = 'CONFIRMADO' or (status = 'CANCELADO' and confirmado_em is not null)) = (confirmado_em is not null)),
  check (confirmado_em is null or (data_evento is not null and recebido_por is not null
         and local_id is not null and responsavel_id is not null)),
  check ((status = 'CANCELADO') = (cancelado_em is not null)),
  check (status <> 'CANCELADO' or length(trim(coalesce(motivo_cancelamento, ''))) >= 10),
  -- RN-25: autorização de excesso sempre com justificativa, autor e data.
  check ((excesso_autorizado_por is null) = (excesso_autorizado_em is null)),
  check (excesso_autorizado_por is null or length(trim(coalesce(excesso_justificativa, ''))) >= 10)
);
create index recebimentos_locacao_idx on public.recebimentos (empresa_id, locacao_id);
create index recebimentos_status_idx on public.recebimentos (empresa_id, status);
create index recebimentos_local_idx on public.recebimentos (empresa_id, local_id);
create index recebimentos_recebido_por_idx on public.recebimentos (empresa_id, recebido_por);
create index recebimentos_responsavel_idx on public.recebimentos (empresa_id, responsavel_id);
create index recebimentos_excesso_por_idx on public.recebimentos (empresa_id, excesso_autorizado_por);

create table public.bens (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  codigo text not null,
  item_locacao_id uuid not null,
  recebimento_id uuid,
  substitui_bem_id uuid,
  identificacao_fornecedor text check (identificacao_fornecedor is null or length(trim(identificacao_fornecedor)) between 1 and 80),
  numero_serie text check (numero_serie is null or length(trim(numero_serie)) between 1 and 80),
  placa text check (placa is null or length(trim(placa)) between 1 and 20),
  status public.status_bem not null default 'AGUARDANDO_RECEBIMENTO',
  -- Cache do último evento confirmado (RN-30); só funções de domínio alteram.
  local_atual_id uuid,
  responsavel_atual_id uuid,
  observacoes text check (observacoes is null or length(observacoes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  unique (empresa_id, id),
  unique (empresa_id, codigo),
  foreign key (empresa_id, item_locacao_id) references public.itens_locacao (empresa_id, id),
  foreign key (empresa_id, recebimento_id) references public.recebimentos (empresa_id, id),
  foreign key (empresa_id, substitui_bem_id) references public.bens (empresa_id, id),
  foreign key (empresa_id, local_atual_id) references public.locais (empresa_id, id),
  foreign key (empresa_id, responsavel_atual_id) references public.usuarios_empresa (empresa_id, user_id),
  check (substitui_bem_id is null or substitui_bem_id <> id),
  -- Todo bem em poder da empresa tem local e responsável.
  check (
    status not in ('DISPONIVEL', 'EM_USO', 'EM_TRANSFERENCIA', 'EM_MANUTENCAO', 'DEVOLUCAO_SOLICITADA')
    or (local_atual_id is not null and responsavel_atual_id is not null)
  ),
  -- Origem rastreável: veio de um recebimento ou substitui outro bem (troca).
  check (recebimento_id is not null or substitui_bem_id is not null)
);
-- Um bem só pode ser substituído uma vez.
create unique index bens_substitui_uk on public.bens (empresa_id, substitui_bem_id)
  where substitui_bem_id is not null;
create unique index bens_serie_item_uk on public.bens (item_locacao_id, lower(numero_serie))
  where numero_serie is not null and status <> 'CANCELADO';
create index bens_item_idx on public.bens (empresa_id, item_locacao_id);
create index bens_recebimento_idx on public.bens (empresa_id, recebimento_id);
create index bens_status_idx on public.bens (empresa_id, status);
create index bens_local_idx on public.bens (empresa_id, local_atual_id);
create index bens_responsavel_idx on public.bens (empresa_id, responsavel_atual_id);
create index bens_codigo_trgm on public.bens using gin (codigo extensions.gin_trgm_ops);
create index bens_serie_trgm on public.bens using gin (numero_serie extensions.gin_trgm_ops);
create index bens_placa_trgm on public.bens using gin (placa extensions.gin_trgm_ops);
create index bens_ident_trgm on public.bens using gin (identificacao_fornecedor extensions.gin_trgm_ops);

create table public.lotes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  codigo text not null,
  item_locacao_id uuid not null,
  recebimento_id uuid,
  lote_origem_id uuid,
  quantidade_recebida numeric(14, 3) not null check (quantidade_recebida > 0),
  quantidade_devolvida numeric(14, 3) not null default 0 check (quantidade_devolvida >= 0),
  quantidade_dividida numeric(14, 3) not null default 0 check (quantidade_dividida >= 0),
  quantidade_baixada numeric(14, 3) not null default 0 check (quantidade_baixada >= 0),
  saldo numeric(14, 3) generated always as (
    quantidade_recebida - quantidade_devolvida - quantidade_dividida - quantidade_baixada
  ) stored,
  status public.status_lote not null default 'ATIVO',
  local_atual_id uuid not null,
  responsavel_atual_id uuid not null,
  observacoes text check (observacoes is null or length(observacoes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  unique (empresa_id, id),
  unique (empresa_id, codigo),
  foreign key (empresa_id, item_locacao_id) references public.itens_locacao (empresa_id, id),
  foreign key (empresa_id, recebimento_id) references public.recebimentos (empresa_id, id),
  foreign key (empresa_id, lote_origem_id) references public.lotes (empresa_id, id),
  foreign key (empresa_id, local_atual_id) references public.locais (empresa_id, id),
  foreign key (empresa_id, responsavel_atual_id) references public.usuarios_empresa (empresa_id, user_id),
  -- Saldo nunca negativo; devolvido nunca maior que recebido (RN-58).
  check (quantidade_devolvida + quantidade_dividida + quantidade_baixada <= quantidade_recebida),
  -- Origem: um recebimento (lote raiz) ou outro lote (divisão), nunca ambos.
  check ((recebimento_id is null) <> (lote_origem_id is null)),
  check (lote_origem_id is null or lote_origem_id <> id),
  check (
    status = 'CANCELADO'
    or (status = 'ATIVO') = (quantidade_recebida - quantidade_devolvida - quantidade_dividida - quantidade_baixada > 0)
  )
);
create index lotes_item_idx on public.lotes (empresa_id, item_locacao_id);
create index lotes_recebimento_idx on public.lotes (empresa_id, recebimento_id);
create index lotes_origem_idx on public.lotes (empresa_id, lote_origem_id);
create index lotes_status_idx on public.lotes (empresa_id, status);
create index lotes_local_idx on public.lotes (empresa_id, local_atual_id);
create index lotes_responsavel_idx on public.lotes (empresa_id, responsavel_atual_id);
create index lotes_codigo_trgm on public.lotes using gin (codigo extensions.gin_trgm_ops);

create table public.itens_recebimento (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  recebimento_id uuid not null,
  item_locacao_id uuid not null,
  -- INDIVIDUAL: um bem por linha (quantidade 1). LOTE: quantidade; o lote é
  -- criado na confirmação e vinculado aqui.
  bem_id uuid,
  lote_id uuid,
  quantidade numeric(14, 3) not null check (quantidade > 0),
  condicao public.condicao_item not null default 'BOM',
  observacao text check (observacao is null or length(observacao) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  unique (empresa_id, id),
  foreign key (empresa_id, recebimento_id) references public.recebimentos (empresa_id, id),
  foreign key (empresa_id, item_locacao_id) references public.itens_locacao (empresa_id, id),
  foreign key (empresa_id, bem_id) references public.bens (empresa_id, id),
  foreign key (empresa_id, lote_id) references public.lotes (empresa_id, id),
  check (not (bem_id is not null and lote_id is not null)),
  check (bem_id is null or quantidade = 1)
);
create unique index itens_recebimento_bem_uk on public.itens_recebimento (bem_id) where bem_id is not null;
create unique index itens_recebimento_lote_uk on public.itens_recebimento (lote_id) where lote_id is not null;
create index itens_recebimento_recebimento_idx on public.itens_recebimento (empresa_id, recebimento_id);
create index itens_recebimento_item_idx on public.itens_recebimento (empresa_id, item_locacao_id);
create index itens_recebimento_bem_idx on public.itens_recebimento (empresa_id, bem_id);
create index itens_recebimento_lote_idx on public.itens_recebimento (empresa_id, lote_id);
