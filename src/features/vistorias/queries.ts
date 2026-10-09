import "server-only";

import { type Contexto } from "@/lib/auth/contexto";
import { intervaloPaginacao, type Paginacao } from "@/lib/validation/comum";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Vistorias (exceto canceladas), mais recentes primeiro; usada pela lista e pelo painel. */
export async function listarVistorias(
  contexto: Contexto,
  filtros: { status: "RASCUNHO" | "CONCLUIDA" | null; paginacao: Paginacao },
) {
  const { de, ate } = intervaloPaginacao(filtros.paginacao);
  const supabase = await createSupabaseServerClient();
  let consulta = supabase
    .from("vistorias")
    .select(
      "id, tipo, status, data_evento, bens(codigo), lotes(codigo), modelos_checklist(nome, versao)",
      { count: "exact" },
    )
    .eq("empresa_id", contexto.empresa.id)
    .neq("status", "CANCELADA")
    .order("data_evento", { ascending: false })
    .range(de, ate);
  if (filtros.status) consulta = consulta.eq("status", filtros.status);
  const { data, count, error } = await consulta;
  if (error) throw new Error("Falha ao listar vistorias");
  return {
    linhas: (data ?? []).map((v) => ({
      id: v.id,
      tipo: v.tipo,
      status: v.status,
      dataEvento: v.data_evento,
      alvo: v.bens?.codigo ?? v.lotes?.codigo ?? "Item em recebimento",
      checklist: v.modelos_checklist
        ? `${v.modelos_checklist.nome} v${v.modelos_checklist.versao}`
        : "—",
    })),
    total: count ?? 0,
  };
}
