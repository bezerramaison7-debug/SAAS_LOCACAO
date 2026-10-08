import pg from "pg";

import { TEST_DATABASE_URL } from "./db";

/** Falha cedo, com instrução clara, se o banco de testes não estiver pronto. */
export default async function setup(): Promise<void> {
  const cliente = new pg.Client({ connectionString: TEST_DATABASE_URL });
  try {
    await cliente.connect();
  } catch {
    throw new Error(
      `Banco de testes indisponível em ${TEST_DATABASE_URL}.\n` +
        "Com Docker: `supabase start && supabase db reset`.\n" +
        "Sem Docker: `npm run db:local:start && npm run db:local:reset`.",
    );
  }
  try {
    const { rows } = await cliente.query<{ ok: boolean }>(
      "select exists (select 1 from public.empresas where demonstracao) as ok",
    );
    if (!rows[0]?.ok) {
      throw new Error(
        "Banco sem o seed de demonstração. Rode `npm run db:local:reset` (ou `supabase db reset`).",
      );
    }
  } finally {
    await cliente.end();
  }
}
