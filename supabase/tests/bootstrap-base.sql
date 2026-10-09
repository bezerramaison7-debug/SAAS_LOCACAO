-- =============================================================================
-- Camada de compatibilidade Supabase — BASE (D-19, D-36).
--
-- Usada SOMENTE quando o Supabase CLI (Docker) não está disponível. Recria:
--   * papéis anon / authenticated / service_role / authenticator /
--     supabase_auth_admin;
--   * esquema `extensions` com pgcrypto, pg_trgm e uuid-ossp;
--   * esquema `auth` VAZIO, de propriedade de supabase_auth_admin (as tabelas
--     vêm das migrations do GoTrue — stack local — ou do shim de testes);
--   * esquema `storage`: vem das migrations da Storage API (stack local) ou
--     de bootstrap-storage-shim.sql (testes de banco sem stack);
--   * privilégios padrão do Supabase em `public` (GRANT ALL para anon,
--     authenticated e service_role) — as migrations precisam revogá-los, como
--     no Supabase real.
-- Nunca é aplicada em homologação/produção.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator noinherit login password 'postgres';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    create role supabase_auth_admin noinherit createrole login password 'postgres';
  end if;
end
$$;

grant anon, authenticated, service_role to authenticator;
grant anon, authenticated, service_role to postgres;

create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

create schema if not exists auth authorization supabase_auth_admin;
grant usage on schema auth to anon, authenticated, service_role, postgres;
alter role supabase_auth_admin set search_path = auth;
grant create on database postgres to supabase_auth_admin;

-- -------------------------------------------- privilégios padrão (public) ----
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
