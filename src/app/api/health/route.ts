import { NextResponse } from "next/server";

/**
 * Saúde da aplicação. Não expõe versões, variáveis nem detalhes internos.
 * A checagem do banco será incluída na Fase 2.
 */
export function GET() {
  return NextResponse.json(
    { status: "ok", verificado_em: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
