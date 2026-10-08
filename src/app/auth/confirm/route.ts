import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { clientEnv } from "@/lib/env/client";
import { logger } from "@/lib/observability/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Destino dos links de e-mail (convite e recuperação). Os modelos de e-mail
 * (supabase/templates) apontam para cá com `token_hash` — verificado no
 * servidor, funciona em qualquer navegador (não depende de PKCE).
 */
const DESTINO: Partial<Record<EmailOtpType, string>> = {
  recovery: "/recuperar-senha/redefinir",
  invite: "/recuperar-senha/redefinir?convite=1",
};

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  // URL canônica da aplicação (não o Host da requisição): o cookie de sessão
  // pertence a este host, e evita redirecionamento por cabeçalho Host forjado.
  const origem = clientEnv.NEXT_PUBLIC_APP_URL;
  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type") as EmailOtpType | null;
  const destino = tipo ? DESTINO[tipo] : undefined;

  if (tokenHash && tipo && destino && /^[A-Za-z0-9_-]{10,200}$/.test(tokenHash)) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(destino, origem));
    logger.warn("auth.confirmacao.falhou", { modulo: "auth", erro_codigo: error.code ?? "?" });
  }
  return NextResponse.redirect(new URL("/login?erro=link", origem));
}
