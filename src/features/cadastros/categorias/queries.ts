import "server-only";

import { type Contexto } from "@/lib/auth/contexto";
import { filtroBuscaIlike } from "@/lib/db/busca";
import { intervaloPaginacao } from "@/lib/validation/comum";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { type FiltrosCadastro } from "../comum";
import { type ModoControle } from "./schemas";

export type Categoria = {
  id: string;
  nome: string;
  modoControle: ModoControle;
  checklistFamiliaId: string | null;
  exigeNumeroSerie: boolean;
  exigePlaca: boolean;
  exigeIdentFornecedor: boolean;
  exigeVistoriaSaida: boolean;
  unidadePadrao: string;
  ativo: boolean;
};

const COLUNAS =
  "id, nome, modo_controle, checklist_familia_id, exige_numero_serie, exige_placa, exige_ident_fornecedor, exige_vistoria_saida, unidade_padrao, ativo";

type Linha = {
  id: string;
  nome: string;
  modo_controle: ModoControle;
  checklist_familia_id: string | null;
  exige_numero_serie: boolean;
  exige_placa: boolean;
  exige_ident_fornecedor: boolean;
  exige_vistoria_saida: boolean;
  unidade_padrao: string;
  ativo: boolean;
};

function paraCategoria(l: Linha): Categoria {
  return {
    id: l.id,
    nome: l.nome,
    modoControle: l.modo_controle,
    checklistFamiliaId: l.checklist_familia_id,
    exigeNumeroSerie: l.exige_numero_serie,
    exigePlaca: l.exige_placa,
    exigeIdentFornecedor: l.exige_ident_fornecedor,
    exigeVistoriaSaida: l.exige_vistoria_saida,
    unidadePadrao: l.unidade_padrao,
    ativo: l.ativo,
  };
}

export async function listarCategorias(contexto: Contexto, filtros: FiltrosCadastro) {
  const supabase = await createSupabaseServerClient();
  const { de, ate } = intervaloPaginacao(filtros.paginacao);
  let consulta = supabase
    .from("categorias_bem")
    .select(COLUNAS, { count: "exact" })
    .eq("empresa_id", contexto.empresa.id)
    .order("nome")
    .range(de, ate);
  if (filtros.situacao !== "todos") consulta = consulta.eq("ativo", filtros.situacao === "ativos");
  const busca = filtroBuscaIlike(["nome"], filtros.q);
  if (busca) consulta = consulta.or(busca);
  const { data, count, error } = await consulta;
  if (error) throw new Error("Falha ao listar categorias");
  return { linhas: (data ?? []).map(paraCategoria), total: count ?? 0 };
}

export async function obterCategoria(contexto: Contexto, id: string): Promise<Categoria | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("categorias_bem")
    .select(COLUNAS)
    .eq("empresa_id", contexto.empresa.id)
    .eq("id", id)
    .maybeSingle();
  return data ? paraCategoria(data) : null;
}

/** Opções para itens de locação (somente ativas). */
export async function opcoesCategorias(contexto: Contexto) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("categorias_bem")
    .select("id, nome, modo_controle, unidade_padrao")
    .eq("empresa_id", contexto.empresa.id)
    .eq("ativo", true)
    .order("nome");
  return (data ?? []).map((c) => ({
    id: c.id,
    nome: c.nome,
    modoControle: c.modo_controle,
    unidadePadrao: c.unidade_padrao,
  }));
}

/** Famílias de checklist com versão publicada (vigente) — a versão é resolvida no uso (RN-81). */
export async function opcoesFamiliasChecklist(contexto: Contexto) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("modelos_checklist")
    .select("familia_id, nome, versao")
    .eq("empresa_id", contexto.empresa.id)
    .eq("status", "PUBLICADO")
    .order("nome");
  return (data ?? []).map((m) => ({
    valor: m.familia_id,
    rotulo: `${m.nome} (v${m.versao} vigente)`,
  }));
}
