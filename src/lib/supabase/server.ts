import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { clientEnv } from "@/lib/env/client";
import type { Database } from "@/types/database";
import { REQUEST_ID_HEADER } from "@/lib/observability/request-id";
import { getRequestId } from "@/lib/observability/request-context";

import { opcoesCookieAuth } from "./cookies";

/**
 * Cliente Supabase no contexto do usuário autenticado (JWT do cookie).
 * Todas as consultas passam por RLS. Deve ser criado por requisição.
 *
 * Para autorização use sempre `auth.getClaims()`/`auth.getUser()` — nunca
 * `getSession()`, cujo conteúdo vem do cookie sem verificação.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const requestId = await getRequestId();

  return createServerClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: opcoesCookieAuth(),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(lista) {
          try {
            for (const { name, value, options } of lista) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Chamado a partir de um Server Component, onde cookies são somente
            // leitura. A renovação da sessão é feita pelo proxy (src/proxy.ts).
          }
        },
      },
      // Propagado ao PostgREST; os triggers de auditoria leem este cabeçalho.
      global: { headers: { [REQUEST_ID_HEADER]: requestId } },
    },
  );
}
