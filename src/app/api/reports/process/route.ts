import { type NextRequest, NextResponse } from "next/server";

import { serverEnv } from "@/lib/env/server";
import { autorizacaoWorkerValida } from "@/lib/relatorios/integridade";
import { processarFila } from "@/lib/relatorios/processar";

/** Tempo máximo para gerar alguns PDFs com fotos (onde a plataforma permitir). */
export const maxDuration = 300;

/**
 * Worker de relatórios (D-16): chamado por qualquer agendador HTTP (cron) a
 * cada minuto. Exige `Authorization: Bearer <REPORT_SIGNING_SECRET>`; sem
 * sessão de usuário (rota pública no proxy, protegida pelo segredo).
 */
async function processar(request: NextRequest) {
  if (
    !autorizacaoWorkerValida(request.headers.get("authorization"), serverEnv.REPORT_SIGNING_SECRET)
  ) {
    return NextResponse.json(
      { erro: "nao_autorizado" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  const resultado = await processarFila(5);
  return NextResponse.json(resultado, { headers: { "Cache-Control": "no-store" } });
}

export const POST = processar;
export const GET = processar;
