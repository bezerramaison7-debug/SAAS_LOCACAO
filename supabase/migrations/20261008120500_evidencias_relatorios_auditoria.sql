-- =============================================================================
-- 006 — Evidências, relatórios, auditoria, auditoria de autenticação e
--        limite de taxa.
-- =============================================================================

create table public.evidencias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  entidade_tipo public.entidade_evidencia not null,
  entidade_id uuid not null,
  tipo public.tipo_evidencia not null,
  bucket text not null,
  -- RN-91: {empresa_id}/{entidade_tipo}/{entidade_id}/{uuid}.{ext}. Nunca URL assinada (RN-94).
  storage_path text not null unique,
  nome_original text check (nome_original is null or length(nome_original) <= 255),
  mime_type text not null,
  tamanho_bytes bigint not null check (tamanho_bytes > 0 and tamanho_bytes <= 52428800),
  hash_arquivo text not null check (hash_arquivo ~ '^[0-9a-f]{64}$'),
  -- RN-93: informada pelo dispositivo (não confiável) ≠ registrada pelo servidor.
  capturada_em timestamptz,
  enviada_em timestamptz not null default now(),
  enviada_por uuid not null default auth.uid(),
  latitude numeric(9, 6) check (latitude is null or latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude is null or longitude between -180 and 180),
  legenda text check (legenda is null or length(legenda) <= 500),
  pergunta_id uuid,
  status public.status_evidencia not null default 'ATIVA',
  substituida_por_id uuid,
  motivo_remocao text,
  removida_em timestamptz,
  removida_por uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  unique (empresa_id, id),
  foreign key (empresa_id, enviada_por) references public.usuarios_empresa (empresa_id, user_id),
  foreign key (empresa_id, pergunta_id) references public.perguntas_checklist (empresa_id, id),
  foreign key (empresa_id, substituida_por_id) references public.evidencias (empresa_id, id),
  check (bucket in ('evidencias', 'contratos', 'comprovantes')),
  check (
    (tipo in ('FOTO', 'DOCUMENTO') and bucket = 'evidencias')
    or (tipo = 'CONTRATO' and bucket = 'contratos')
    or (tipo = 'COMPROVANTE' and bucket = 'comprovantes')
  ),
  check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  check (tipo <> 'FOTO' or mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  check (storage_path ~ '^[0-9a-f-]{36}/[a-z_]+/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$'),
  check (split_part(storage_path, '/', 1) = empresa_id::text),
  check (split_part(storage_path, '/', 3) = entidade_id::text),
  check ((latitude is null) = (longitude is null)),
  check ((status = 'SUBSTITUIDA') = (substituida_por_id is not null)),
  check (substituida_por_id is null or substituida_por_id <> id),
  check ((status = 'REMOVIDA') = (removida_em is not null)),
  check (status <> 'REMOVIDA' or length(trim(coalesce(motivo_remocao, ''))) >= 10)
);
create index evidencias_entidade_idx on public.evidencias (empresa_id, entidade_tipo, entidade_id);
create index evidencias_enviada_por_idx on public.evidencias (empresa_id, enviada_por);
create index evidencias_pergunta_idx on public.evidencias (empresa_id, pergunta_id);
create index evidencias_substituida_idx on public.evidencias (empresa_id, substituida_por_id);
create index evidencias_hash_idx on public.evidencias (empresa_id, hash_arquivo);

-- Garante que a entidade referenciada existe e é da mesma empresa
-- (vínculo polimórfico não pode ser FK).
create function privado.validar_entidade_evidencia() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tabela text;
  v_existe boolean;
begin
  v_tabela := case new.entidade_tipo
    when 'LOCACAO' then 'locacoes'
    when 'RECEBIMENTO' then 'recebimentos'
    when 'ITEM_RECEBIMENTO' then 'itens_recebimento'
    when 'BEM' then 'bens'
    when 'LOTE' then 'lotes'
    when 'VISTORIA' then 'vistorias'
    when 'RESPOSTA_VISTORIA' then 'respostas_vistoria'
    when 'MOVIMENTACAO' then 'movimentacoes'
    when 'OCORRENCIA' then 'ocorrencias'
    when 'DEVOLUCAO' then 'devolucoes'
    when 'COBRANCA' then 'cobrancas'
  end;
  execute format('select exists (select 1 from public.%I where id = $1 and empresa_id = $2)', v_tabela)
    into v_existe using new.entidade_id, new.empresa_id;
  if not v_existe then
    raise exception 'Entidade de evidência inexistente ou de outra empresa'
      using errcode = '23503';
  end if;
  if split_part(new.storage_path, '/', 2) <> lower(new.entidade_tipo::text) then
    raise exception 'storage_path não corresponde ao tipo de entidade' using errcode = '23514';
  end if;
  return new;
end
$$;

create trigger evidencias_validar_entidade
  before insert or update of entidade_tipo, entidade_id, storage_path, empresa_id
  on public.evidencias
  for each row execute function privado.validar_entidade_evidencia();

create table public.relatorios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  codigo text not null,
  tipo public.tipo_relatorio not null,
  parametros jsonb not null check (jsonb_typeof(parametros) = 'object'),
  status public.status_relatorio not null default 'PENDENTE',
  solicitado_por uuid not null,
  versao_template text not null,
  storage_path text unique,
  hash_arquivo text check (hash_arquivo is null or hash_arquivo ~ '^[0-9a-f]{64}$'),
  hash_dados text check (hash_dados is null or hash_dados ~ '^[0-9a-f]{64}$'),
  assinatura_hmac text check (assinatura_hmac is null or assinatura_hmac ~ '^[0-9a-f]{64}$'),
  tentativas integer not null default 0 check (tentativas between 0 and 10),
  erro text check (erro is null or length(erro) <= 2000),
  iniciado_em timestamptz,
  concluido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  unique (empresa_id, id),
  unique (empresa_id, codigo),
  foreign key (empresa_id, solicitado_por) references public.usuarios_empresa (empresa_id, user_id),
  check (storage_path is null or split_part(storage_path, '/', 1) = empresa_id::text),
  check (status <> 'CONCLUIDO' or (storage_path is not null and hash_arquivo is not null
         and hash_dados is not null and assinatura_hmac is not null and concluido_em is not null)),
  check (status <> 'ERRO' or erro is not null)
);
create index relatorios_status_idx on public.relatorios (status, created_at) where status in ('PENDENTE', 'PROCESSANDO');
create index relatorios_empresa_idx on public.relatorios (empresa_id, created_at desc);
create index relatorios_solicitado_por_idx on public.relatorios (empresa_id, solicitado_por);

-- Auditoria append-only (RN e docs/architecture.md §8).
create table public.auditoria (
  id bigint generated always as identity primary key,
  empresa_id uuid references public.empresas (id) on delete restrict,
  ator_id uuid,
  acao text not null check (acao ~ '^[a-z_]+\.[a-z_]+$'),
  entidade_tipo text not null,
  entidade_id uuid,
  dados_anteriores jsonb,
  dados_novos jsonb,
  contexto jsonb,
  request_id text check (request_id is null or length(request_id) <= 64),
  created_at timestamptz not null default now()
);
create index auditoria_entidade_idx on public.auditoria (empresa_id, entidade_tipo, entidade_id, created_at desc);
create index auditoria_empresa_data_idx on public.auditoria (empresa_id, created_at desc);
create index auditoria_ator_idx on public.auditoria (empresa_id, ator_id, created_at desc);

-- Login/falha de login: sem empresa, sem senha; e-mail e IP apenas como hash.
create table privado.auditoria_autenticacao (
  id bigint generated always as identity primary key,
  evento text not null check (evento in ('login.sucesso', 'login.falha', 'logout', 'senha.recuperacao', 'senha.redefinida')),
  user_id uuid,
  email_hash text check (email_hash is null or email_hash ~ '^[0-9a-f]{64}$'),
  ip_hash text check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$'),
  motivo text check (motivo is null or length(motivo) <= 200),
  request_id text,
  created_at timestamptz not null default now()
);
create index auditoria_autenticacao_data_idx on privado.auditoria_autenticacao (created_at desc);

-- ----------------------------------------------------- limite de taxa --------
create table privado.limites_config (
  acao text primary key check (acao ~ '^[a-z_.]+$'),
  maximo integer not null check (maximo > 0),
  janela_segundos integer not null check (janela_segundos > 0)
);

insert into privado.limites_config (acao, maximo, janela_segundos) values
  ('evidencia.upload', 60, 60),
  ('relatorio.gerar', 10, 600),
  ('usuarios.convidar', 20, 3600);

create table privado.limites_taxa (
  chave text not null,
  janela_inicio timestamptz not null,
  contador integer not null default 0,
  primary key (chave, janela_inicio)
);

-- D-20: retorna true se a ação ainda cabe no limite do usuário atual.
create function public.consumir_limite_taxa(p_acao text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_config privado.limites_config;
  v_uid uuid := (select auth.uid());
  v_janela timestamptz;
  v_contador integer;
begin
  if v_uid is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  select * into v_config from privado.limites_config where acao = p_acao;
  if not found then
    raise exception 'Ação sem limite configurado: %', p_acao using errcode = '22023';
  end if;
  v_janela := to_timestamp(floor(extract(epoch from now()) / v_config.janela_segundos) * v_config.janela_segundos);
  insert into privado.limites_taxa as l (chave, janela_inicio, contador)
  values (p_acao || ':' || v_uid::text, v_janela, 1)
  on conflict (chave, janela_inicio) do update set contador = l.contador + 1
  returning contador into v_contador;
  delete from privado.limites_taxa where janela_inicio < now() - interval '1 day';
  return v_contador <= v_config.maximo;
end
$$;

revoke execute on function public.consumir_limite_taxa(text) from public, anon;
grant execute on function public.consumir_limite_taxa(text) to authenticated;
