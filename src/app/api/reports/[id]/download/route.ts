import { type NextRequest, NextResponse } from "next/server";

import { getEstadoAcesso } from "@/lib/auth/contexto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/comum";

/**
 * GET /api/reports/{id}/download — URL assinada de 5 minutos, gerada com o
 * cliente do usuário (RLS do relatório + policy do bucket `relatorios`).
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteContext<"/api/reports/[id]/download">,
) {
  const id = uuidSchema.safeParse((await params).id);
  const acesso = await getEstadoAcesso();
  const naoEncontrado = () =>
    NextResponse.json(
      { erro: "Relatório não encontrado ou ainda não concluído." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  if (!id.success || acesso.estado !== "ok") return naoEncontrado();
  const supabase = await createSupabaseServerClient();
  const { data: r } = await supabase
    .from("relatorios")
    .select("codigo, storage_path")
    .eq("empresa_id", acesso.contexto.empresa.id)
    .eq("id", id.data)
    .eq("status", "CONCLUIDO")
    .maybeSingle();
  if (!r?.storage_path) return naoEncontrado();
  const { data } = await supabase.storage
    .from("relatorios")
    .createSignedUrl(r.storage_path, 300, { download: `${r.codigo}.pdf` });
  if (!data?.signedUrl) return naoEncontrado();
  return NextResponse.redirect(data.signedUrl, {
    status: 302,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}
