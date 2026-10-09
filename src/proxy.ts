import { type NextRequest, NextResponse } from "next/server";

import { rotaPublica } from "@/lib/auth/redirecionamento";
import { clientEnv } from "@/lib/env/client";
import { REQUEST_ID_HEADER, resolverRequestId } from "@/lib/observability/request-id";
import { gerarNonce, montarCsp } from "@/lib/security/csp";
import { atualizarSessao } from "@/lib/supabase/proxy";

/**
 * Executado antes de cada rota:
 *  1. request_id (propagado para logs, PostgREST e auditoria);
 *  2. CSP com nonce por requisição;
 *  3. renovação dos cookies de sessão do Supabase;
 *  4. visitante sem sessão em rota privada → /login?next=… (APIs: 401).
 *
 * NÃO é a camada de autorização (D-03): rotas privadas verificam sessão e
 * permissão no servidor (lib/auth) e o banco aplica RLS.
 */
export async function proxy(request: NextRequest) {
  const requestId = resolverRequestId(request.headers.get(REQUEST_ID_HEADER));
  const nonce = gerarNonce();
  const csp = montarCsp({
    nonce,
    supabaseUrl: clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    dev: process.env.NODE_ENV === "development",
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const { response, userId } = await atualizarSessao(request, () =>
    NextResponse.next({ request: { headers: requestHeaders } }),
  );

  const { pathname, search } = request.nextUrl;
  if (!userId && !rotaPublica(pathname)) {
    const negado = pathname.startsWith("/api/")
      ? NextResponse.json({ erro: "nao_autenticado" }, { status: 401 })
      : NextResponse.redirect(
          new URL(
            `/login?next=${encodeURIComponent(pathname + search)}`,
            clientEnv.NEXT_PUBLIC_APP_URL,
          ),
        );
    negado.headers.set(REQUEST_ID_HEADER, requestId);
    // Preserva a limpeza de cookies de sessão inválida feita pelo Supabase.
    for (const cookie of response.cookies.getAll()) negado.cookies.set(cookie);
    return negado;
  }

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

export const config = {
  matcher: [
    {
      // Ignora assets estáticos e prefetches do next/link.
      source:
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
