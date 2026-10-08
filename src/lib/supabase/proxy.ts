import { createServerClient } from "@supabase/ssr";
import { type NextRequest, type NextResponse } from "next/server";

import { clientEnv } from "@/lib/env/client";

import { ehCookieDeAuth, opcoesCookieAuth } from "./cookies";

/**
 * Renova a sessão do Supabase (tokens em cookies) antes da renderização.
 * Não é camada de autorização: a verificação autoritativa ocorre no servidor
 * (lib/auth) e no banco (RLS).
 *
 * `criarResposta` é chamado para (re)criar a resposta com os headers de
 * requisição já ajustados, para que os cookies renovados cheguem tanto ao
 * navegador quanto aos Server Components desta mesma requisição.
 */
export async function atualizarSessao(
  request: NextRequest,
  criarResposta: () => NextResponse,
): Promise<{ response: NextResponse; userId: string | null }> {
  let response = criarResposta();

  // Sem cookie de sessão não há o que renovar (evita chamada de rede).
  if (!request.cookies.getAll().some((c) => ehCookieDeAuth(c.name))) {
    return { response, userId: null };
  }

  const supabase = createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: opcoesCookieAuth(),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(lista, cabecalhos) {
          for (const { name, value } of lista) request.cookies.set(name, value);
          response = criarResposta();
          for (const { name, value, options } of lista) response.cookies.set(name, value, options);
          for (const [chave, valor] of Object.entries(cabecalhos))
            response.headers.set(chave, valor);
        },
      },
    },
  );

  // getClaims valida a assinatura do JWT (e renova a sessão se necessário).
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims.sub;
  return { response, userId: typeof sub === "string" ? sub : null };
}
