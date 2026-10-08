import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { clientEnv } from "@/lib/env/client";
import type { Database } from "@/types/database";

/**
 * Cliente SEM sessão (chave publishable), fluxo implícito. Usado apenas para
 * pedir e-mail de recuperação: assim o link (token_hash) funciona em qualquer
 * navegador — o fluxo PKCE do cliente SSR exigiria o mesmo navegador.
 */
export function createSupabaseAnonClient(): SupabaseClient<Database> {
  return createClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        flowType: "implicit",
      },
    },
  );
}
