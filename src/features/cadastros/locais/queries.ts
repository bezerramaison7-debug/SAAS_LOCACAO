import "server-only";

import { type Contexto } from "@/lib/auth/contexto";
import { filtroBuscaIlike } from "@/lib/db/busca";
import { intervaloPaginacao } from "@/lib/validation/comum";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { type FiltrosCadastro } from "../comum";
import { type TipoLocal } from "./schemas";

export type Local = {
  id: string;
  codigo: string;
  nome: string;
  tipo: TipoLocal;
  endereco: string | null;
  ativo: boolean;
};

const COLUNAS = "id, codigo, nome, tipo, endereco, ativo";

export async function listarLocais(contexto: Contexto, filtros: FiltrosCadastro) {
  const supabase = await createSupabaseServerClient();
  const { de, ate } = intervaloPaginacao(filtros.paginacao);
  let consulta = supabase
    .from("locais")
    .select(COLUNAS, { count: "exact" })
    .eq("empresa_id", contexto.empresa.id)
    .order("nome")
    .range(de, ate);
  if (filtros.situacao !== "todos") consulta = consulta.eq("ativo", filtros.situacao === "ativos");
  const busca = filtroBuscaIlike(["codigo", "nome", "endereco"], filtros.q);
  if (busca) consulta = consulta.or(busca);
  const { data, count, error } = await consulta;
  if (error) throw new Error("Falha ao listar locais");
  return { linhas: (data ?? []) satisfies Local[], total: count ?? 0 };
}

export async function obterLocal(contexto: Contexto, id: string): Promise<Local | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("locais")
    .select(COLUNAS)
    .eq("empresa_id", contexto.empresa.id)
    .eq("id", id)
    .maybeSingle();
  return data;
}

/** Opções para selects (somente ativos). */
export async function opcoesLocais(contexto: Contexto) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("locais")
    .select("id, codigo, nome")
    .eq("empresa_id", contexto.empresa.id)
    .eq("ativo", true)
    .order("nome");
  return (data ?? []).map((l) => ({ id: l.id, rotulo: `${l.nome} (${l.codigo})` }));
}
