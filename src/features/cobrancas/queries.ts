import "server-only";

import { type Contexto } from "@/lib/auth/contexto";
import { filtroBuscaIlike } from "@/lib/db/busca";
import { intervaloPaginacao, type Paginacao } from "@/lib/validation/comum";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const VISOES_COBRANCA = {
  PENDENTES: { rotulo: "Pendentes", status: ["PENDENTE"] },
  DIVERGENTES: { rotulo: "Divergentes", status: ["DIVERGENTE"] },
  CONFERIDAS: { rotulo: "Conferidas", status: ["CONFERIDA"] },
  RESOLVIDAS: { rotulo: "Resolvidas", status: ["RESOLVIDA"] },
  TODAS: { rotulo: "Todas", status: [] },
} as const;
export type VisaoCobranca = keyof typeof VISOES_COBRANCA;

export type FiltrosCobranca = {
  q: string;
  visao: VisaoCobranca;
  /** Cobranças sem documento anexo (evidências pendentes — §5.2). */
  semDocumento: boolean;
  paginacao: Paginacao;
};

const COLUNAS =
  "id, codigo, status, locacao_id, competencia_inicio, competencia_fim, valor_cobrado::text, numero_documento, observacoes, motivo_divergencia, resolucao, conferida_em, divergente_em, resolvida_em, created_at, locacoes(codigo, status_financeiro)";

/** Exige `valores.ver` (RLS de cobrancas). */
export async function listarCobrancas(contexto: Contexto, filtros: FiltrosCobranca) {
  const supabase = await createSupabaseServerClient();
  const { de, ate } = intervaloPaginacao(filtros.paginacao);
  let consulta = supabase
    .from("cobrancas")
    .select(COLUNAS, { count: "exact" })
    .eq("empresa_id", contexto.empresa.id)
    .order("competencia_inicio", { ascending: false })
    .range(de, ate);
  const status = VISOES_COBRANCA[filtros.visao].status;
  if (status.length) consulta = consulta.in("status", [...status]);
  if (filtros.semDocumento) {
    const { data: com } = await supabase
      .from("evidencias")
      .select("entidade_id")
      .eq("empresa_id", contexto.empresa.id)
      .eq("entidade_tipo", "COBRANCA")
      .eq("status", "ATIVA")
      .limit(1000);
    const ids = [...new Set((com ?? []).map((e) => e.entidade_id))];
    if (ids.length) consulta = consulta.not("id", "in", `(${ids.join(",")})`);
  }
  const busca = filtroBuscaIlike(["codigo", "numero_documento"], filtros.q);
  if (busca) consulta = consulta.or(busca);
  const { data, count, error } = await consulta;
  if (error) throw new Error("Falha ao listar cobranças");
  return { linhas: (data ?? []).map(paraCobranca), total: count ?? 0 };
}

type Linha = NonNullable<Awaited<ReturnType<typeof uma>>["data"]>;

async function uma(contexto: Contexto, id: string) {
  const supabase = await createSupabaseServerClient();
  return supabase
    .from("cobrancas")
    .select(COLUNAS)
    .eq("empresa_id", contexto.empresa.id)
    .eq("id", id)
    .maybeSingle();
}

function paraCobranca(c: Linha) {
  return {
    id: c.id,
    codigo: c.codigo,
    status: c.status,
    locacaoId: c.locacao_id,
    locacao: c.locacoes?.codigo ?? "—",
    financeiroEncerrado: c.locacoes?.status_financeiro === "ENCERRADO",
    competenciaInicio: c.competencia_inicio,
    competenciaFim: c.competencia_fim,
    valor: c.valor_cobrado,
    documento: c.numero_documento,
    observacoes: c.observacoes,
    motivoDivergencia: c.motivo_divergencia,
    resolucao: c.resolucao,
    conferidaEm: c.conferida_em,
    divergenteEm: c.divergente_em,
    resolvidaEm: c.resolvida_em,
    criadaEm: c.created_at,
  };
}

export async function obterCobranca(contexto: Contexto, id: string) {
  const { data } = await uma(contexto, id);
  return data ? paraCobranca(data) : null;
}

/**
 * Pendências do financeiro: locações com encerramento pendente e devoluções
 * retiradas sem ciência (RN-56).
 */
export async function pendenciasFinanceiras(contexto: Contexto) {
  const supabase = await createSupabaseServerClient();
  const [{ data: locacoes }, { data: devolucoes }] = await Promise.all([
    supabase
      .from("locacoes")
      .select("id, codigo, status")
      .eq("empresa_id", contexto.empresa.id)
      .eq("status_financeiro", "ENCERRAMENTO_PENDENTE")
      .order("codigo")
      .limit(100),
    supabase
      .from("devolucoes")
      .select("id, codigo, retirada_em, locacoes!devolucoes_empresa_id_locacao_id_fkey(codigo)")
      .eq("empresa_id", contexto.empresa.id)
      .not("retirada_confirmada_em", "is", null)
      .is("ciencia_financeira_em", null)
      .order("retirada_em")
      .limit(100),
  ]);
  return {
    encerramentos: (locacoes ?? []).map((l) => ({ id: l.id, codigo: l.codigo, status: l.status })),
    ciencias: (devolucoes ?? []).map((d) => ({
      id: d.id,
      codigo: d.codigo,
      retiradaEm: d.retirada_em,
      locacao: d.locacoes?.codigo ?? "—",
    })),
  };
}

/** RN-72/73: estimativa por item no período (texto decimal; arredondar só na tela). */
export async function estimativa(locacaoId: string, inicio: string, fim: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("estimativa_locacao", {
    p_locacao: locacaoId,
    p_inicio: inicio,
    p_fim: fim,
  });
  if (error) return { erro: error, linhas: [] as const };
  return {
    erro: null,
    linhas: (data ?? []).map((e) => ({
      itemId: e.item_locacao_id,
      descricao: e.descricao,
      unidade: e.unidade,
      periodicidade: e.periodicidade,
      valorUnitario: e.valor_unitario,
      unidadesDia: e.unidades_dia,
      valor: e.valor_estimado,
    })),
  };
}
