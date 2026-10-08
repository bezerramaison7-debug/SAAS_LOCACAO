import "server-only";

import { type Contexto } from "@/lib/auth/contexto";
import { filtroBuscaIlike } from "@/lib/db/busca";
import { intervaloPaginacao } from "@/lib/validation/comum";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { type FiltrosCadastro } from "../comum";
import { type ExigeFoto, type StatusChecklist, type TipoResposta } from "./schemas";

export type ModeloChecklist = {
  id: string;
  familiaId: string;
  versao: number;
  nome: string;
  descricao: string | null;
  status: StatusChecklist;
  publicadoEm: string | null;
  perguntas: number;
};

export type Pergunta = {
  id: string;
  ordem: number;
  texto: string;
  tipoResposta: TipoResposta;
  opcoes: string[] | null;
  obrigatoria: boolean;
  exigeFoto: ExigeFoto;
};

const COLUNAS =
  "id, familia_id, versao, nome, descricao, status, publicado_em, perguntas_checklist(count)";

type Linha = {
  id: string;
  familia_id: string;
  versao: number;
  nome: string;
  descricao: string | null;
  status: StatusChecklist;
  publicado_em: string | null;
  perguntas_checklist: { count: number }[];
};

function paraModelo(l: Linha): ModeloChecklist {
  return {
    id: l.id,
    familiaId: l.familia_id,
    versao: l.versao,
    nome: l.nome,
    descricao: l.descricao,
    status: l.status,
    publicadoEm: l.publicado_em,
    perguntas: l.perguntas_checklist[0]?.count ?? 0,
  };
}

/** "Ativos" = rascunhos e vigentes; "inativos" = versões arquivadas. */
export async function listarModelos(contexto: Contexto, filtros: FiltrosCadastro) {
  const supabase = await createSupabaseServerClient();
  const { de, ate } = intervaloPaginacao(filtros.paginacao);
  let consulta = supabase
    .from("modelos_checklist")
    .select(COLUNAS, { count: "exact" })
    .eq("empresa_id", contexto.empresa.id)
    .order("nome")
    .order("versao", { ascending: false })
    .range(de, ate);
  if (filtros.situacao === "ativos") consulta = consulta.in("status", ["RASCUNHO", "PUBLICADO"]);
  if (filtros.situacao === "inativos") consulta = consulta.eq("status", "ARQUIVADO");
  const busca = filtroBuscaIlike(["nome", "descricao"], filtros.q);
  if (busca) consulta = consulta.or(busca);
  const { data, count, error } = await consulta;
  if (error) throw new Error("Falha ao listar checklists");
  return { linhas: (data ?? []).map(paraModelo), total: count ?? 0 };
}

export async function obterModelo(contexto: Contexto, id: string): Promise<ModeloChecklist | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("modelos_checklist")
    .select(COLUNAS)
    .eq("empresa_id", contexto.empresa.id)
    .eq("id", id)
    .maybeSingle();
  return data ? paraModelo(data) : null;
}

/** Todas as versões da família, da mais nova para a mais antiga. */
export async function versoesDaFamilia(contexto: Contexto, familiaId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("modelos_checklist")
    .select(COLUNAS)
    .eq("empresa_id", contexto.empresa.id)
    .eq("familia_id", familiaId)
    .order("versao", { ascending: false });
  return (data ?? []).map(paraModelo);
}

function paraExigeFoto(valor: unknown): ExigeFoto {
  const v = (valor ?? {}) as { modo?: unknown; respostas?: unknown };
  if (v.modo === "SEMPRE") return { modo: "SEMPRE" };
  if (v.modo === "RESPOSTAS" && Array.isArray(v.respostas)) {
    return {
      modo: "RESPOSTAS",
      respostas: v.respostas.filter((r): r is string => typeof r === "string"),
    };
  }
  return { modo: "NUNCA" };
}

export async function listarPerguntas(contexto: Contexto, modeloId: string): Promise<Pergunta[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("perguntas_checklist")
    .select("id, ordem, texto, tipo_resposta, opcoes, obrigatoria, exige_foto_se")
    .eq("empresa_id", contexto.empresa.id)
    .eq("modelo_id", modeloId)
    .order("ordem");
  if (error) throw new Error("Falha ao listar perguntas");
  return (data ?? []).map((p) => ({
    id: p.id,
    ordem: p.ordem,
    texto: p.texto,
    tipoResposta: p.tipo_resposta,
    opcoes: Array.isArray(p.opcoes)
      ? p.opcoes.filter((o): o is string => typeof o === "string")
      : null,
    obrigatoria: p.obrigatoria,
    exigeFoto: paraExigeFoto(p.exige_foto_se),
  }));
}
