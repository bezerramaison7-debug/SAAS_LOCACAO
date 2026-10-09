import { type NextRequest, NextResponse } from "next/server";

import { getEstadoAcesso } from "@/lib/auth/contexto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/comum";

const SEM_CACHE = { "Cache-Control": "no-store" };

/** GET /api/reports/{id} — situação do relatório (RLS de quem consulta), para acompanhamento. */
export async function GET(_request: NextRequest, { params }: RouteContext<"/api/reports/[id]">) {
  const id = uuidSchema.safeParse((await params).id);
  const acesso = await getEstadoAcesso();
  if (!id.success || acesso.estado !== "ok") {
    return NextResponse.json(
      { erro: "Relatório não encontrado." },
      { status: 404, headers: SEM_CACHE },
    );
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("relatorios")
    .select("id, codigo, status, erro, tentativas, concluido_em")
    .eq("empresa_id", acesso.contexto.empresa.id)
    .eq("id", id.data)
    .maybeSingle();
  if (!data)
    return NextResponse.json(
      { erro: "Relatório não encontrado." },
      { status: 404, headers: SEM_CACHE },
    );
  return NextResponse.json(data, { headers: SEM_CACHE });
}
