import { afterAll, describe, expect, it } from "vitest";

import { comoAtor, encerrarPool, superusuario } from "../support/db";

afterAll(encerrarPool);

/** Tabelas em que DELETE é permitido (somente linhas de rascunho — D-31). */
const DELETE_PERMITIDO = [
  "itens_devolucao",
  "itens_locacao",
  "itens_recebimento",
  "perguntas_checklist",
  "referencias_externas",
  "respostas_vistoria",
].sort();

/** Colunas que NUNCA podem ser gravadas diretamente por usuários (D-04). */
const COLUNAS_PROTEGIDAS = [
  "status",
  "status_financeiro",
  "empresa_id",
  "codigo",
  "local_atual_id",
  "responsavel_atual_id",
  "quantidade_recebida",
  "quantidade_devolvida",
  "quantidade_dividida",
  "quantidade_baixada",
  "created_by",
  "updated_by",
  "created_at",
  "updated_at",
  "papel",
];

describe("estrutura de segurança do banco", () => {
  it("toda tabela de public tem RLS habilitado", async () => {
    const semRls = await comoAtor(superusuario, (s) =>
      s.query<{ tablename: string }>(
        "select tablename from pg_tables where schemaname = 'public' and not rowsecurity",
      ),
    );
    expect(semRls).toEqual([]);
  });

  it("anon não tem nenhum privilégio em tabelas, visões ou funções de public", async () => {
    await comoAtor(superusuario, async (s) => {
      const tabelas = await s.query(
        `select table_name, privilege_type from information_schema.role_table_grants
         where grantee = 'anon' and table_schema = 'public'`,
      );
      expect(tabelas).toEqual([]);
      const funcoes = await s.query(
        `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname in ('public', 'privado') and has_function_privilege('anon', p.oid, 'execute')`,
      );
      expect(funcoes).toEqual([]);
      const esquemaPrivado = await s.query<{ ok: boolean }>(
        "select has_schema_privilege('anon', 'privado', 'usage') as ok",
      );
      expect(esquemaPrivado[0]?.ok).toBe(false);
    });
  });

  it("authenticated só pode apagar linhas de rascunho (tabelas permitidas)", async () => {
    const linhas = await comoAtor(superusuario, (s) =>
      s.query<{ table_name: string }>(
        `select distinct table_name from information_schema.role_table_grants
         where grantee = 'authenticated' and table_schema = 'public' and privilege_type = 'DELETE'
         order by table_name`,
      ),
    );
    expect(linhas.map((l) => l.table_name)).toEqual(DELETE_PERMITIDO);
  });

  it("nenhuma coluna protegida é gravável (INSERT/UPDATE) por authenticated", async () => {
    const graváveis = await comoAtor(superusuario, (s) =>
      s.query<{ tabela: string; coluna: string; privilegio: string }>(
        `select table_name as tabela, column_name as coluna, privilege_type as privilegio
         from information_schema.column_privileges
         where grantee = 'authenticated' and table_schema = 'public'
           and privilege_type in ('INSERT', 'UPDATE')
           and column_name = any($1)
           and not (column_name = 'empresa_id' and privilege_type = 'INSERT')
           and not (table_name in ('locais', 'centros_custo') and column_name = 'codigo' and privilege_type = 'INSERT')`,
        [COLUNAS_PROTEGIDAS],
      ),
    );
    expect(graváveis).toEqual([]);
  });

  it("toda função SECURITY DEFINER fixa o search_path", async () => {
    const semSearchPath = await comoAtor(superusuario, (s) =>
      s.query<{ funcao: string }>(
        `select n.nspname || '.' || p.proname as funcao
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname in ('public', 'privado') and p.prosecdef
           and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`,
      ),
    );
    expect(semSearchPath).toEqual([]);
  });

  it("buckets são privados e não há policy de escrita no storage", async () => {
    await comoAtor(superusuario, async (s) => {
      const buckets = await s.query<{ id: string; public: boolean }>(
        "select id, public from storage.buckets order by id",
      );
      expect(buckets).toEqual([
        { id: "comprovantes", public: false },
        { id: "contratos", public: false },
        { id: "evidencias", public: false },
        { id: "relatorios", public: false },
      ]);
      const escrita = await s.query(
        `select policyname, cmd from pg_policies
         where schemaname = 'storage' and tablename = 'objects' and cmd <> 'SELECT'`,
      );
      expect(escrita).toEqual([]);
    });
  });

  it("toda FK tem índice começando pelas mesmas colunas", async () => {
    const semIndice = await comoAtor(superusuario, (s) =>
      s.query<{ tabela: string; restricao: string }>(
        `select c.conrelid::regclass::text as tabela, c.conname as restricao
         from pg_constraint c
         join pg_namespace n on n.oid = c.connamespace
         where c.contype = 'f' and n.nspname = 'public'
           and not exists (
             select 1 from pg_index i
             where i.indrelid = c.conrelid
               and (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] = c.conkey
           )
           -- FKs para auth.users (autoria) não precisam de índice de busca.
           and c.confrelid <> 'auth.users'::regclass
         order by 1, 2`,
      ),
    );
    expect(semIndice).toEqual([]);
  });
});
