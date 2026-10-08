-- =============================================================================
-- 003 — Cadastros: fornecedores, locais, centros de custo, checklists
--        versionados e categorias de bem.
-- Convenção: toda tabela operacional tem `unique (empresa_id, id)` para
-- permitir FKs compostas que impedem vínculo entre empresas (D-05).
-- =============================================================================

create table public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  razao_social text not null check (length(trim(razao_social)) between 2 and 200),
  nome_fantasia text check (nome_fantasia is null or length(trim(nome_fantasia)) between 1 and 200),
  documento text check (documento is null or length(trim(documento)) between 5 and 30),
  contato jsonb not null default '{}'::jsonb check (jsonb_typeof(contato) = 'object'),
  observacoes text check (observacoes is null or length(observacoes) <= 2000),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  unique (empresa_id, id)
);
create unique index fornecedores_documento_uk
  on public.fornecedores (empresa_id, documento) where documento is not null;
create index fornecedores_razao_trgm
  on public.fornecedores using gin (razao_social extensions.gin_trgm_ops);
create index fornecedores_fantasia_trgm
  on public.fornecedores using gin (nome_fantasia extensions.gin_trgm_ops);

create table public.locais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  codigo text not null check (codigo ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{0,39}$'),
  nome text not null check (length(trim(nome)) between 2 and 200),
  tipo public.tipo_local not null default 'OBRA',
  endereco text check (endereco is null or length(endereco) <= 500),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  unique (empresa_id, id),
  unique (empresa_id, codigo)
);
create index locais_nome_trgm on public.locais using gin (nome extensions.gin_trgm_ops);

create table public.centros_custo (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  codigo text not null check (codigo ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{0,39}$'),
  nome text not null check (length(trim(nome)) between 2 and 200),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  unique (empresa_id, id),
  unique (empresa_id, codigo)
);

-- Checklists versionados (RN-80): (familia_id, versao). Versão PUBLICADA é imutável.
create table public.modelos_checklist (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  familia_id uuid not null default gen_random_uuid(),
  versao integer not null default 1 check (versao >= 1),
  nome text not null check (length(trim(nome)) between 2 and 200),
  descricao text check (descricao is null or length(descricao) <= 2000),
  status public.status_checklist not null default 'RASCUNHO',
  publicado_em timestamptz,
  publicado_por uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  unique (empresa_id, id),
  unique (empresa_id, familia_id, versao),
  check ((status = 'RASCUNHO') = (publicado_em is null))
);
-- No máximo uma versão publicada (vigente) por família.
create unique index modelos_checklist_vigente_uk
  on public.modelos_checklist (empresa_id, familia_id) where status = 'PUBLICADO';

create table public.perguntas_checklist (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  modelo_id uuid not null,
  ordem integer not null check (ordem between 1 and 500),
  texto text not null check (length(trim(texto)) between 3 and 500),
  tipo_resposta public.tipo_resposta not null,
  opcoes jsonb check (opcoes is null or jsonb_typeof(opcoes) = 'array'),
  obrigatoria boolean not null default true,
  -- {"modo":"NUNCA"} | {"modo":"SEMPRE"} | {"modo":"RESPOSTAS","respostas":["NAO_CONFORME"]}
  exige_foto_se jsonb not null default '{"modo":"NUNCA"}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  unique (empresa_id, id),
  unique (modelo_id, ordem),
  foreign key (empresa_id, modelo_id) references public.modelos_checklist (empresa_id, id),
  check ((tipo_resposta = 'OPCAO_UNICA') = (opcoes is not null and jsonb_array_length(opcoes) >= 2)),
  check (
    exige_foto_se->>'modo' in ('NUNCA', 'SEMPRE')
    or (exige_foto_se->>'modo' = 'RESPOSTAS'
        and jsonb_typeof(exige_foto_se->'respostas') = 'array'
        and jsonb_array_length(exige_foto_se->'respostas') >= 1)
  )
);
create index perguntas_checklist_modelo_idx on public.perguntas_checklist (empresa_id, modelo_id);

create table public.categorias_bem (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  nome text not null check (length(trim(nome)) between 2 and 120),
  modo_controle public.modo_controle not null,
  -- Família do checklist; a versão vigente (PUBLICADA) é resolvida no uso
  -- e congelada na vistoria (RN-81).
  checklist_familia_id uuid,
  exige_numero_serie boolean not null default false,
  exige_placa boolean not null default false,
  exige_ident_fornecedor boolean not null default false,
  exige_vistoria_saida boolean not null default true,
  unidade_padrao text not null default 'un' check (length(trim(unidade_padrao)) between 1 and 20),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  unique (empresa_id, id),
  -- Identificação individual só faz sentido para controle INDIVIDUAL.
  check (modo_controle = 'INDIVIDUAL' or not (exige_numero_serie or exige_placa or exige_ident_fornecedor))
);
create unique index categorias_bem_nome_uk on public.categorias_bem (empresa_id, lower(nome));
