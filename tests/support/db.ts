import pg from "pg";

/**
 * Acesso ao banco de testes simulando o PostgREST: cada operação roda em uma
 * transação SEMPRE revertida, com `set local role` (anon | authenticated |
 * service_role) e as claims do JWT em `request.jwt.claims` — exatamente o que
 * o Supabase faz por requisição. O banco seedado nunca é alterado pelos testes.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

if (!/@(127\.0\.0\.1|localhost)(:\d+)?\//.test(TEST_DATABASE_URL) && !process.env.CI) {
  throw new Error("Testes de banco só podem rodar contra banco local (TEST_DATABASE_URL).");
}

let pool: pg.Pool | undefined;

export function getPool(): pg.Pool {
  pool ??= new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 4 });
  return pool;
}

export async function encerrarPool(): Promise<void> {
  await pool?.end();
  pool = undefined;
}

export type Ator =
  | { tipo: "anon" }
  | { tipo: "usuario"; id: string }
  | { tipo: "service_role" }
  | { tipo: "postgres" };

export const anon: Ator = { tipo: "anon" };
export const serviceRole: Ator = { tipo: "service_role" };
export const superusuario: Ator = { tipo: "postgres" };
export const usuario = (id: string): Ator => ({ tipo: "usuario", id });

export type Resultado<T = Record<string, unknown>> =
  { ok: true; rows: T[]; rowCount: number } | { ok: false; codigo: string; mensagem: string };

export type Sessao = {
  /** Executa dentro de um savepoint: um erro não aborta a transação do teste. */
  tentar<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<Resultado<T>>;
  /** Executa e lança em caso de erro. */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Muda o ator dentro da mesma transação (útil para preparar dados como postgres). */
  como(ator: Ator): Promise<void>;
};

async function aplicarAtor(cliente: pg.PoolClient, ator: Ator, requestId: string): Promise<void> {
  await cliente.query("reset role");
  const claims =
    ator.tipo === "usuario"
      ? { sub: ator.id, role: "authenticated", aud: "authenticated" }
      : ator.tipo === "anon"
        ? { role: "anon" }
        : ator.tipo === "service_role"
          ? { role: "service_role" }
          : null;
  await cliente.query("select set_config('request.jwt.claims', $1, true)", [
    claims ? JSON.stringify(claims) : "",
  ]);
  await cliente.query("select set_config('request.jwt.claim.sub', '', true)");
  await cliente.query("select set_config('request.headers', $1, true)", [
    JSON.stringify({ "x-request-id": requestId }),
  ]);
  if (ator.tipo === "usuario") await cliente.query("set local role authenticated");
  else if (ator.tipo === "anon") await cliente.query("set local role anon");
  else if (ator.tipo === "service_role") await cliente.query("set local role service_role");
}

let contadorSavepoint = 0;

/** Abre uma transação como `ator`, executa `fn` e SEMPRE faz rollback. */
export async function comoAtor<T>(
  ator: Ator,
  fn: (sessao: Sessao) => Promise<T>,
  requestId = "00000000-0000-4000-8000-000000000000",
): Promise<T> {
  const cliente = await getPool().connect();
  try {
    await cliente.query("begin");
    await aplicarAtor(cliente, ator, requestId);
    const sessao: Sessao = {
      async tentar<R>(sql: string, params: unknown[] = []): Promise<Resultado<R>> {
        const sp = `sp_${++contadorSavepoint}`;
        await cliente.query(`savepoint ${sp}`);
        try {
          const r = await cliente.query(sql, params);
          await cliente.query(`release savepoint ${sp}`);
          return { ok: true, rows: r.rows as R[], rowCount: r.rowCount ?? 0 };
        } catch (erro) {
          await cliente.query(`rollback to savepoint ${sp}`);
          const e = erro as { code?: string; message?: string };
          return { ok: false, codigo: e.code ?? "?", mensagem: e.message ?? String(erro) };
        }
      },
      async query<R>(sql: string, params: unknown[] = []): Promise<R[]> {
        const r = await cliente.query(sql, params);
        return r.rows as R[];
      },
      como: (novo) => aplicarAtor(cliente, novo, requestId),
    };
    return await fn(sessao);
  } finally {
    await cliente.query("rollback").catch(() => undefined);
    cliente.release();
  }
}

/** Códigos SQLSTATE usados nas asserções. */
export const SQLSTATE = {
  privilegioInsuficiente: "42501",
  violacaoCheck: "23514",
  violacaoUnique: "23505",
  violacaoFk: "23503",
  violacaoNotNull: "23502",
} as const;
