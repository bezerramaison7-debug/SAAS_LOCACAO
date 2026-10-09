import "server-only";

import { type Contexto } from "@/lib/auth/contexto";
import { filtroBuscaIlike } from "@/lib/db/busca";
import { intervaloPaginacao } from "@/lib/validation/comum";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { type FiltrosCadastro } from "../comum";

export type Fornecedor = {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  documento: string | null;
  contatoNome: string | null;
  contatoEmail: string | null;
  contatoTelefone: string | null;
  observacoes: string | null;
  ativo: boolean;
};

type Linha = {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  documento: string | null;
  contato: unknown;
  observacoes: string | null;
  ativo: boolean;
};

function paraFornecedor(l: Linha): Fornecedor {
  const contato = (l.contato ?? {}) as Record<string, unknown>;
  const texto = (v: unknown) => (typeof v === "string" && v ? v : null);
  return {
    id: l.id,
    razaoSocial: l.razao_social,
    nomeFantasia: l.nome_fantasia,
    documento: l.documento,
    contatoNome: texto(contato.nome),
    contatoEmail: texto(contato.email),
    contatoTelefone: texto(contato.telefone),
    observacoes: l.observacoes,
    ativo: l.ativo,
  };
}

const COLUNAS = "id, razao_social, nome_fantasia, documento, contato, observacoes, ativo";

export async function listarFornecedores(contexto: Contexto, filtros: FiltrosCadastro) {
  const supabase = await createSupabaseServerClient();
  const { de, ate } = intervaloPaginacao(filtros.paginacao);
  let consulta = supabase
    .from("fornecedores")
    .select(COLUNAS, { count: "exact" })
    .eq("empresa_id", contexto.empresa.id)
    .order("razao_social")
    .range(de, ate);
  if (filtros.situacao !== "todos") consulta = consulta.eq("ativo", filtros.situacao === "ativos");
  const busca = filtroBuscaIlike(["razao_social", "nome_fantasia", "documento"], filtros.q);
  if (busca) consulta = consulta.or(busca);
  const { data, count, error } = await consulta;
  if (error) throw new Error("Falha ao listar fornecedores");
  return { linhas: (data ?? []).map(paraFornecedor), total: count ?? 0 };
}

export async function obterFornecedor(contexto: Contexto, id: string): Promise<Fornecedor | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("fornecedores")
    .select(COLUNAS)
    .eq("empresa_id", contexto.empresa.id)
    .eq("id", id)
    .maybeSingle();
  return data ? paraFornecedor(data) : null;
}

/** Opções para selects (somente ativos). */
export async function opcoesFornecedores(contexto: Contexto) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("fornecedores")
    .select("id, razao_social, nome_fantasia")
    .eq("empresa_id", contexto.empresa.id)
    .eq("ativo", true)
    .order("razao_social");
  return (data ?? []).map((f) => ({
    id: f.id,
    rotulo: f.nome_fantasia ? `${f.nome_fantasia} — ${f.razao_social}` : f.razao_social,
  }));
}
