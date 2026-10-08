import { type NextRequest, NextResponse } from "next/server";

import { clientEnv } from "@/lib/env/client";
import { type ResultadoSaude, verificarSupabase } from "@/lib/observability/saude";

/**
 * Saúde da aplicação, sem expor versões, variáveis ou detalhes internos.
 *  - GET /api/health            → vivacidade (o processo responde)
 *  - GET /api/health?profundo=1 → prontidão (Supabase acessível); 503 se não
 */
export async function GET(request: NextRequest) {
  const corpo: ResultadoSaude = { status: "ok", verificado_em: new Date().toISOString() };
  let http = 200;

  if (request.nextUrl.searchParams.get("profundo") === "1") {
    const supabase = await verificarSupabase(
      clientEnv.NEXT_PUBLIC_SUPABASE_URL,
      clientEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
    corpo.dependencias = { supabase };
    if (supabase !== "ok") {
      corpo.status = "degradado";
      http = 503;
    }
  }

  return NextResponse.json(corpo, { status: http, headers: { "Cache-Control": "no-store" } });
}
