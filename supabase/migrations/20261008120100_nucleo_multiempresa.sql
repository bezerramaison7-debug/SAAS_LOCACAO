-- =============================================================================
-- 002 — Núcleo multiempresa: empresas, usuários, papéis, permissões,
--        funções de segurança e sequência de códigos.
-- =============================================================================

create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 2 and 200),
  documento text check (documento is null or length(trim(documento)) between 5 and 30),
  timezone text not null default 'America/Sao_Paulo',
  exige_aceite_movimentacao boolean not null default false,
  limite_atraso_horas integer not null default 24 check (limite_atraso_horas between 1 and 720),
  limite_upload_imagem_mb integer not null default 15 check (limite_upload_imagem_mb between 1 and 50),
  limite_upload_pdf_mb integer not null default 20 check (limite_upload_pdf_mb between 1 and 50),
  demonstracao boolean not null default false,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id)
);

create unique index empresas_documento_uk on public.empresas (documento) where documento is not null;

-- Valida o fuso contra o catálogo do Postgres.
create function privado.validar_timezone() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Fuso horário inválido: %', new.timezone using errcode = '22023';
  end if;
  return new;
end
$$;

create trigger empresas_validar_timezone
  before insert or update of timezone on public.empresas
  for each row execute function privado.validar_timezone();

create table public.perfis_usuario (
  user_id uuid primary key references auth.users (id) on delete restrict,
  nome text not null check (length(trim(nome)) between 2 and 200),
  telefone text check (telefone is null or length(trim(telefone)) between 8 and 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id)
);

-- Um papel por usuário em cada empresa (S-07). Responsáveis por bens são
-- referenciados por (empresa_id, user_id), garantindo a mesma empresa (D-21).
create table public.usuarios_empresa (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  user_id uuid not null references public.perfis_usuario (user_id) on delete restrict,
  papel public.papel_usuario not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  unique (empresa_id, user_id)
);

create index usuarios_empresa_user_ativo_idx
  on public.usuarios_empresa (user_id, empresa_id) where ativo;

-- Espelho da matriz de permissões (src/lib/permissions/matriz.ts). Teste de
-- paridade garante igualdade. Somente migrations alteram esta tabela.
create table privado.papel_permissoes (
  papel public.papel_usuario not null,
  permissao text not null check (permissao ~ '^[a-z_]+(\.[a-z_]+)+$'),
  primary key (papel, permissao)
);

insert into privado.papel_permissoes (papel, permissao)
select p.papel::public.papel_usuario, p.permissao
from (values
  -- leitura
  ('ADMIN', 'dados.ler_geral'), ('COMPRAS', 'dados.ler_geral'), ('OPERACAO', 'dados.ler_geral'),
  ('FINANCEIRO', 'dados.ler_geral'), ('GESTOR', 'dados.ler_geral'), ('AUDITOR', 'dados.ler_geral'),
  ('ADMIN', 'valores.ver'), ('COMPRAS', 'valores.ver'), ('OPERACAO', 'valores.ver'),
  ('FINANCEIRO', 'valores.ver'), ('GESTOR', 'valores.ver'), ('AUDITOR', 'valores.ver'),
  ('ADMIN', 'auditoria.ler'), ('GESTOR', 'auditoria.ler'), ('AUDITOR', 'auditoria.ler'),
  -- empresa / usuários
  ('ADMIN', 'empresa.configurar'),
  ('ADMIN', 'usuarios.gerenciar'),
  -- cadastros
  ('ADMIN', 'fornecedor.gerenciar'), ('COMPRAS', 'fornecedor.gerenciar'),
  ('ADMIN', 'local.gerenciar'), ('COMPRAS', 'local.gerenciar'), ('OPERACAO', 'local.gerenciar'),
  ('ADMIN', 'centro_custo.gerenciar'), ('COMPRAS', 'centro_custo.gerenciar'),
  ('FINANCEIRO', 'centro_custo.gerenciar'),
  ('ADMIN', 'categoria.gerenciar'), ('COMPRAS', 'categoria.gerenciar'),
  ('ADMIN', 'checklist.gerenciar'), ('OPERACAO', 'checklist.gerenciar'),
  -- locação
  ('ADMIN', 'locacao.criar'), ('COMPRAS', 'locacao.criar'),
  ('ADMIN', 'locacao.editar'), ('COMPRAS', 'locacao.editar'),
  ('ADMIN', 'locacao.referencia.gerenciar'), ('COMPRAS', 'locacao.referencia.gerenciar'),
  ('ADMIN', 'locacao.ativar'), ('COMPRAS', 'locacao.ativar'),
  ('ADMIN', 'locacao.cancelar'), ('COMPRAS', 'locacao.cancelar'),
  ('ADMIN', 'locacao.iniciar_desmobilizacao'), ('OPERACAO', 'locacao.iniciar_desmobilizacao'),
  ('ADMIN', 'locacao.encerrar_operacional'), ('OPERACAO', 'locacao.encerrar_operacional'),
  ('ADMIN', 'locacao.encerrar_financeiro'), ('FINANCEIRO', 'locacao.encerrar_financeiro'),
  -- recebimento
  ('ADMIN', 'recebimento.registrar'), ('OPERACAO', 'recebimento.registrar'),
  ('ADMIN', 'recebimento.autorizar_excesso'), ('COMPRAS', 'recebimento.autorizar_excesso'),
  ('ADMIN', 'recebimento.cancelar_confirmado'),
  -- vistoria / movimentação
  ('ADMIN', 'vistoria.registrar'), ('OPERACAO', 'vistoria.registrar'),
  ('ADMIN', 'movimentacao.registrar'), ('OPERACAO', 'movimentacao.registrar'),
  ('ADMIN', 'movimentacao.aceitar'), ('COMPRAS', 'movimentacao.aceitar'),
  ('OPERACAO', 'movimentacao.aceitar'), ('RESPONSAVEL_LOCAL', 'movimentacao.aceitar'),
  ('FINANCEIRO', 'movimentacao.aceitar'), ('GESTOR', 'movimentacao.aceitar'),
  -- ocorrência / troca
  ('ADMIN', 'ocorrencia.registrar'), ('COMPRAS', 'ocorrencia.registrar'),
  ('OPERACAO', 'ocorrencia.registrar'), ('RESPONSAVEL_LOCAL', 'ocorrencia.registrar'),
  ('FINANCEIRO', 'ocorrencia.registrar'),
  ('ADMIN', 'ocorrencia.tratar'), ('OPERACAO', 'ocorrencia.tratar'),
  ('ADMIN', 'troca.registrar'), ('OPERACAO', 'troca.registrar'),
  -- devolução
  ('ADMIN', 'devolucao.gerenciar'), ('OPERACAO', 'devolucao.gerenciar'),
  ('ADMIN', 'devolucao.ciencia_financeira'), ('FINANCEIRO', 'devolucao.ciencia_financeira'),
  -- cobrança
  ('ADMIN', 'cobranca.gerenciar'), ('FINANCEIRO', 'cobranca.gerenciar'),
  ('ADMIN', 'cobranca.ver_estimativa'), ('COMPRAS', 'cobranca.ver_estimativa'),
  ('FINANCEIRO', 'cobranca.ver_estimativa'), ('GESTOR', 'cobranca.ver_estimativa'),
  ('AUDITOR', 'cobranca.ver_estimativa'),
  -- evidências
  ('ADMIN', 'evidencia.enviar'), ('COMPRAS', 'evidencia.enviar'), ('OPERACAO', 'evidencia.enviar'),
  ('RESPONSAVEL_LOCAL', 'evidencia.enviar'), ('FINANCEIRO', 'evidencia.enviar'),
  ('ADMIN', 'evidencia.substituir_remover'), ('OPERACAO', 'evidencia.substituir_remover'),
  -- relatórios
  ('ADMIN', 'relatorio.gerar'), ('COMPRAS', 'relatorio.gerar'), ('OPERACAO', 'relatorio.gerar'),
  ('FINANCEIRO', 'relatorio.gerar'), ('GESTOR', 'relatorio.gerar'), ('AUDITOR', 'relatorio.gerar')
) as p (papel, permissao);

-- ----------------------------------------------- funções de segurança --------
-- SECURITY DEFINER para não depender (nem recursar) na RLS de usuarios_empresa.
-- `(select auth.uid())` é avaliado uma vez por consulta (desempenho em RLS).

create function privado.usuario_pertence_empresa(p_empresa uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.usuarios_empresa ue
    join public.empresas e on e.id = ue.empresa_id
    where ue.empresa_id = p_empresa
      and ue.user_id = (select auth.uid())
      and ue.ativo
      and e.ativo
  )
$$;

create function privado.usuario_papel(p_empresa uuid)
returns public.papel_usuario
language sql stable security definer
set search_path = ''
as $$
  select ue.papel
  from public.usuarios_empresa ue
  join public.empresas e on e.id = ue.empresa_id
  where ue.empresa_id = p_empresa
    and ue.user_id = (select auth.uid())
    and ue.ativo
    and e.ativo
$$;

create function privado.usuario_tem_permissao(p_empresa uuid, p_permissao text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.usuarios_empresa ue
    join public.empresas e on e.id = ue.empresa_id
    join privado.papel_permissoes pp on pp.papel = ue.papel
    where ue.empresa_id = p_empresa
      and ue.user_id = (select auth.uid())
      and ue.ativo
      and e.ativo
      and pp.permissao = p_permissao
  )
$$;

-- Empresas em que o usuário atual tem associação ativa (para policies de
-- tabelas sem empresa própria, como perfis_usuario).
create function privado.empresas_do_usuario()
returns setof uuid
language sql stable security definer
set search_path = ''
as $$
  select ue.empresa_id
  from public.usuarios_empresa ue
  join public.empresas e on e.id = ue.empresa_id
  where ue.user_id = (select auth.uid()) and ue.ativo and e.ativo
$$;

-- Wrapper público exigido pela especificação (`usuario_pertence_empresa`).
-- Só responde sobre o próprio usuário; útil para a aplicação e diagnósticos.
create function public.usuario_pertence_empresa(empresa_uuid uuid)
returns boolean
language sql stable
set search_path = ''
as $$
  select privado.usuario_pertence_empresa(empresa_uuid)
$$;

-- ------------------------------------------------- códigos legíveis ----------
create table privado.sequencias (
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  prefixo text not null check (prefixo ~ '^[A-Z]{3}$'),
  proximo bigint not null check (proximo > 0),
  primary key (empresa_id, prefixo)
);

-- D-09: incremento participa da transação; formato PREFIXO-000123.
create function privado.proximo_codigo(p_empresa uuid, p_prefixo text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_numero bigint;
begin
  insert into privado.sequencias as s (empresa_id, prefixo, proximo)
  values (p_empresa, p_prefixo, 2)
  on conflict (empresa_id, prefixo) do update set proximo = s.proximo + 1
  returning s.proximo - 1 into v_numero;
  return p_prefixo || '-' || lpad(v_numero::text, 6, '0');
end
$$;

grant execute on function
  privado.usuario_pertence_empresa(uuid),
  privado.usuario_papel(uuid),
  privado.usuario_tem_permissao(uuid, text),
  privado.empresas_do_usuario(),
  privado.transicao_permitida(text, text, text)
to authenticated, service_role;

grant execute on function public.usuario_pertence_empresa(uuid) to authenticated, service_role;
revoke execute on function public.usuario_pertence_empresa(uuid) from anon;
