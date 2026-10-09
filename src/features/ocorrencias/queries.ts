import "server-only";

import { type Contexto } from "@/lib/auth/contexto";
import { filtroBuscaIlike } from "@/lib/db/busca";
import { intervaloPaginacao, type Paginacao } from "@/lib/validation/comum";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { type StatusOcorrencia, type TipoOcorrencia } from "./rotulos";

export type FiltrosOcorrencia = {
  q: string;
  status: StatusOcorrencia | "EM_ABERTO" | null;
  tipo: TipoOcorrencia | null;
  vencidas: boolean;
  paginacao: Paginacao;
};

const COLUNAS =
  "id, codigo, tipo, status, prioridade, descricao, prazo, data_evento, quantidade::text, locacao_id, bem_id, lote_id, recebimento_id, responsavel_id, resultado, resolucao, resolvida_em, reaberta_em, motivo_reabertura, cancelada_em, motivo_cancelamento, bem_substituto_id, status_anterior_bem, created_at, locacoes(codigo), bens!ocorrencias_empresa_id_bem_id_fkey(codigo), lotes(codigo)";

export async function listarOcorrencias(contexto: Contexto, filtros: FiltrosOcorrencia) {
  const supabase = await createSupabaseServerClient();
  const { de, ate } = intervaloPaginacao(filtros.paginacao);
  let consulta = supabase
    .from("ocorrencias")
    .select(COLUNAS, { count: "exact" })
    .eq("empresa_id", contexto.empresa.id)
    .order("data_evento", { ascending: false })
    .range(de, ate);
  if (filtros.status === "EM_ABERTO") consulta = consulta.in("status", ["ABERTA", "EM_TRATAMENTO"]);
  else if (filtros.status) consulta = consulta.eq("status", filtros.status);
  if (filtros.tipo) consulta = consulta.eq("tipo", filtros.tipo);
  if (filtros.vencidas) {
    consulta = consulta
      .in("status", ["ABERTA", "EM_TRATAMENTO"])
      .lt("prazo", new Date().toISOString());
  }
  const busca = filtroBuscaIlike(["codigo", "descricao"], filtros.q);
  if (busca) consulta = consulta.or(busca);
  const { data, count, error } = await consulta;
  if (error) throw new Error("Falha ao listar ocorrências");
  return { linhas: (data ?? []).map(paraOcorrencia), total: count ?? 0 };
}

type Linha = NonNullable<Awaited<ReturnType<typeof consultaUma>>["data"]>;

async function consultaUma(contexto: Contexto, id: string) {
  const supabase = await createSupabaseServerClient();
  return supabase
    .from("ocorrencias")
    .select(COLUNAS)
    .eq("empresa_id", contexto.empresa.id)
    .eq("id", id)
    .maybeSingle();
}

function paraOcorrencia(o: Linha) {
  return {
    id: o.id,
    codigo: o.codigo,
    tipo: o.tipo,
    status: o.status,
    prioridade: o.prioridade,
    descricao: o.descricao,
    prazo: o.prazo,
    dataEvento: o.data_evento,
    quantidade: o.quantidade,
    locacaoId: o.locacao_id,
    locacao: o.locacoes?.codigo ?? "—",
    bemId: o.bem_id,
    loteId: o.lote_id,
    alvo: o.bens?.codigo ?? o.lotes?.codigo ?? null,
    recebimentoId: o.recebimento_id,
    responsavelId: o.responsavel_id,
    resultado: o.resultado,
    resolucao: o.resolucao,
    resolvidaEm: o.resolvida_em,
    reabertaEm: o.reaberta_em,
    motivoReabertura: o.motivo_reabertura,
    canceladaEm: o.cancelada_em,
    motivoCancelamento: o.motivo_cancelamento,
    bemSubstitutoId: o.bem_substituto_id,
    alterouSituacao: o.status_anterior_bem !== null,
  };
}
export type Ocorrencia = ReturnType<typeof paraOcorrencia>;

export async function obterOcorrencia(contexto: Contexto, id: string): Promise<Ocorrencia | null> {
  const { data } = await consultaUma(contexto, id);
  return data ? paraOcorrencia(data) : null;
}

/** Ocorrências em aberto de um bem/lote (alertas da ficha). */
export async function ocorrenciasAbertasDe(
  contexto: Contexto,
  alvo: { bem?: string; lote?: string },
) {
  const supabase = await createSupabaseServerClient();
  let consulta = supabase
    .from("ocorrencias")
    .select(COLUNAS)
    .eq("empresa_id", contexto.empresa.id)
    .in("status", ["ABERTA", "EM_TRATAMENTO"]);
  consulta = alvo.bem ? consulta.eq("bem_id", alvo.bem) : consulta.eq("lote_id", alvo.lote ?? "");
  const { data } = await consulta;
  return (data ?? []).map(paraOcorrencia);
}
