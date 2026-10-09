import "server-only";

import { type Contexto } from "@/lib/auth/contexto";
import { filtroBuscaIlike } from "@/lib/db/busca";
import { intervaloPaginacao } from "@/lib/validation/comum";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { type FiltrosCadastro } from "../comum";

export type CentroCusto = { id: string; codigo: string; nome: string; ativo: boolean };

const COLUNAS = "id, codigo, nome, ativo";

export async function listarCentrosCusto(contexto: Contexto, filtros: FiltrosCadastro) {
  const supabase = await createSupabaseServerClient();
  const { de, ate } = intervaloPaginacao(filtros.paginacao);
  let consulta = supabase
    .from("centros_custo")
    .select(COLUNAS, { count: "exact" })
    .eq("empresa_id", contexto.empresa.id)
    .order("codigo")
    .range(de, ate);
  if (filtros.situacao !== "todos") consulta = consulta.eq("ativo", filtros.situacao === "ativos");
  const busca = filtroBuscaIlike(["codigo", "nome"], filtros.q);
  if (busca) consulta = consulta.or(busca);
  const { data, count, error } = await consulta;
  if (error) throw new Error("Falha ao listar centros de custo");
  return { linhas: (data ?? []) satisfies CentroCusto[], total: count ?? 0 };
}

export async function obterCentroCusto(
  contexto: Contexto,
  id: string,
): Promise<CentroCusto | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("centros_custo")
    .select(COLUNAS)
    .eq("empresa_id", contexto.empresa.id)
    .eq("id", id)
    .maybeSingle();
  return data;
}

/** Opções para selects (somente ativos). */
export async function opcoesCentrosCusto(contexto: Contexto) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("centros_custo")
    .select("id, codigo, nome")
    .eq("empresa_id", contexto.empresa.id)
    .eq("ativo", true)
    .order("codigo");
  return (data ?? []).map((c) => ({ id: c.id, rotulo: `${c.codigo} — ${c.nome}` }));
}
