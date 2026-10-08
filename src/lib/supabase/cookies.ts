import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * Cookies de sessão (D-25): HttpOnly (inacessíveis a JavaScript do navegador,
 * mitigando roubo de token por XSS), SameSite=Lax e Secure em produção.
 * Consequência: não existe cliente Supabase no navegador; toda leitura e
 * mutação passa pelo servidor.
 */
export function opcoesCookieAuth(): CookieOptionsWithName {
  return {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };
}

/** Cookies de autenticação criados por @supabase/ssr (`sb-<ref>-auth-token[.n]`). */
export function ehCookieDeAuth(nome: string): boolean {
  return nome.startsWith("sb-") && nome.includes("-auth-token");
}
