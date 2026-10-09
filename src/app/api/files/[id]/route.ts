import { type NextRequest, NextResponse } from "next/server";

import { urlAssinada } from "@/lib/evidencias/servidor";
import { uuidSchema } from "@/lib/validation/comum";

/**
 * GET /api/files/{id} — redireciona para uma URL assinada de 5 minutos, gerada
 * só depois de a RLS confirmar o acesso. A URL não é armazenada nem cacheada.
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/files/[id]">) {
  const id = uuidSchema.safeParse((await params).id);
  const url = id.success
    ? await urlAssinada(id.data, request.nextUrl.searchParams.get("download") === "1")
    : null;
  if (!url) {
    return NextResponse.json(
      { erro: "Arquivo não encontrado." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.redirect(url, {
    status: 302,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}
