import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { serverEnv } from "@/lib/env/server";
import type { Database } from "@/types/database";

/**
 * Cliente com SERVICE ROLE — IGNORA RLS.
 *
 * Uso restrito (D-06, D-07):
 *  - escrita no Storage depois que a autorização foi provada com o cliente do usuário;
 *  - administração de usuários do Auth (convite, desativação) por ADMIN;
 *  - worker de relatórios.
 * Nunca usar para consultas comuns da aplicação.
 */
export function createSupabaseAdminClient(): SupabaseClient<Database> {
  return createClient<Database>(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    },
  );
}
