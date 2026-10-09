-- =============================================================================
-- 011 — Administração de usuários e auditoria de autenticação (Fase 3).
--
-- Funções `rpc_*` (security definer) chamadas com o JWT do usuário: derivam a
-- empresa da linha-alvo, exigem `usuarios.gerenciar`, gravam auditoria
-- semântica. Erros com SQLSTATE padronizado (mapeados em src/lib/db/erros.ts):
--   42501 sem permissão · P0002 não encontrado · 23505 duplicado · 22023 inválido
-- =============================================================================

-- Lista de usuários da empresa COM e-mail (auth.users não é exposto).
create function public.rpc_listar_usuarios_empresa(p_empresa uuid)
returns table (
  associacao_id uuid,
  user_id uuid,
  nome text,
  email text,
  papel public.papel_usuario,
  ativo boolean,
  ultimo_acesso timestamptz,
  criado_em timestamptz
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not privado.usuario_tem_permissao(p_empresa, 'usuarios.gerenciar') then
    raise exception 'Sem permissão para gerenciar usuários' using errcode = '42501';
  end if;
  return query
    select ue.id, ue.user_id, p.nome, u.email::text, ue.papel, ue.ativo, u.last_sign_in_at, ue.created_at
    from public.usuarios_empresa ue
    join public.perfis_usuario p on p.user_id = ue.user_id
    join auth.users u on u.id = ue.user_id
    where ue.empresa_id = p_empresa
    order by ue.ativo desc, p.nome;
end
$$;

-- Vincula um usuário do Auth (já existente ou recém-convidado) à empresa.
create function public.rpc_vincular_usuario(
  p_empresa uuid, p_email text, p_nome text, p_papel public.papel_usuario
) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_id uuid;
begin
  if not privado.usuario_tem_permissao(p_empresa, 'usuarios.gerenciar') then
    raise exception 'Sem permissão para gerenciar usuários' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_nome, ''))) < 2 then
    raise exception 'Nome inválido' using errcode = '22023';
  end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'Usuário não encontrado no serviço de autenticação' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.usuarios_empresa where empresa_id = p_empresa and user_id = v_user) then
    raise exception 'Usuário já está associado a esta empresa' using errcode = '23505';
  end if;
  insert into public.perfis_usuario (user_id, nome) values (v_user, trim(p_nome))
  on conflict (user_id) do nothing;
  insert into public.usuarios_empresa (empresa_id, user_id, papel, ativo)
  values (p_empresa, v_user, p_papel, true)
  returning id into v_id;
  perform privado.registrar_auditoria(
    p_empresa, 'usuarios.vincular', 'usuarios_empresa', v_id, null,
    jsonb_build_object('user_id', v_user, 'papel', p_papel), null);
  return v_id;
end
$$;

create function public.rpc_alterar_papel(p_associacao uuid, p_papel public.papel_usuario)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_assoc public.usuarios_empresa;
begin
  select * into v_assoc from public.usuarios_empresa where id = p_associacao for update;
  if not found or not privado.usuario_tem_permissao(v_assoc.empresa_id, 'usuarios.gerenciar') then
    -- Mesmo erro para inexistente e sem permissão (não revela existência).
    raise exception 'Associação não encontrada' using errcode = 'P0002';
  end if;
  if v_assoc.papel = p_papel then
    return;
  end if;
  update public.usuarios_empresa set papel = p_papel where id = p_associacao;
  perform privado.registrar_auditoria(
    v_assoc.empresa_id, 'usuarios.alterar_papel', 'usuarios_empresa', p_associacao,
    jsonb_build_object('papel', v_assoc.papel), jsonb_build_object('papel', p_papel), null);
end
$$;

create function public.rpc_definir_usuario_ativo(p_associacao uuid, p_ativo boolean, p_motivo text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_assoc public.usuarios_empresa;
begin
  select * into v_assoc from public.usuarios_empresa where id = p_associacao for update;
  if not found or not privado.usuario_tem_permissao(v_assoc.empresa_id, 'usuarios.gerenciar') then
    raise exception 'Associação não encontrada' using errcode = 'P0002';
  end if;
  if v_assoc.user_id = (select auth.uid()) and not p_ativo then
    raise exception 'Você não pode desativar o próprio acesso' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_motivo, ''))) < 10 then
    raise exception 'Informe o motivo com pelo menos 10 caracteres' using errcode = '22023';
  end if;
  if v_assoc.ativo = p_ativo then
    return;
  end if;
  update public.usuarios_empresa set ativo = p_ativo where id = p_associacao;
  perform privado.registrar_auditoria(
    v_assoc.empresa_id, case when p_ativo then 'usuarios.reativar' else 'usuarios.desativar' end,
    'usuarios_empresa', p_associacao,
    jsonb_build_object('ativo', v_assoc.ativo), jsonb_build_object('ativo', p_ativo),
    jsonb_build_object('motivo', trim(p_motivo)));
end
$$;

-- Auditoria de autenticação: só o servidor (service_role) grava.
create function public.registrar_evento_autenticacao(
  p_evento text,
  p_user_id uuid default null,
  p_email_hash text default null,
  p_ip_hash text default null,
  p_motivo text default null,
  p_request_id text default null
) returns void
language sql security definer
set search_path = ''
as $$
  insert into privado.auditoria_autenticacao (evento, user_id, email_hash, ip_hash, motivo, request_id)
  values (p_evento, p_user_id, p_email_hash, p_ip_hash, left(p_motivo, 200), left(p_request_id, 64))
$$;

revoke all on function
  public.rpc_listar_usuarios_empresa(uuid),
  public.rpc_vincular_usuario(uuid, text, text, public.papel_usuario),
  public.rpc_alterar_papel(uuid, public.papel_usuario),
  public.rpc_definir_usuario_ativo(uuid, boolean, text),
  public.registrar_evento_autenticacao(text, uuid, text, text, text, text)
from public, anon, authenticated;

grant execute on function
  public.rpc_listar_usuarios_empresa(uuid),
  public.rpc_vincular_usuario(uuid, text, text, public.papel_usuario),
  public.rpc_alterar_papel(uuid, public.papel_usuario),
  public.rpc_definir_usuario_ativo(uuid, boolean, text)
to authenticated;

grant execute on function
  public.registrar_evento_autenticacao(text, uuid, text, text, text, text)
to service_role;

-- privado.registrar_auditoria é chamada só de dentro de funções definer.
revoke all on function privado.registrar_auditoria(uuid, text, text, uuid, jsonb, jsonb, jsonb)
from public, anon, authenticated;
