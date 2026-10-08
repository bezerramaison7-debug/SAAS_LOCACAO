import "server-only";

import { cache } from "react";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type UsuarioAutenticado = { id: string; email: string };

/**
 * Usuário com JWT VERIFICADO (getClaims valida assinatura/expiração; com chave
 * simétrica consulta o Auth). Nunca usar getSession() para autorizar.
 * Memoizado por requisição.
 */
export const getUsuarioAutenticado = cache(async (): Promise<UsuarioAutenticado | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return null;
  const { sub, email } = data.claims;
  if (typeof sub !== "string") return null;
  return { id: sub, email: typeof email === "string" ? email : "" };
});
