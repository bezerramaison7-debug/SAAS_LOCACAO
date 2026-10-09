import "server-only";

import { type Contexto } from "@/lib/auth/contexto";
import { hojeNoFuso } from "@/lib/format/datas";
import { intervaloPaginacao } from "@/lib/validation/comum";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { somarDias, termoLiteral, type FiltrosLocacao } from "./filtros";
import { type Periodicidade, type SistemaExterno, type TipoReferencia } from "./rotulos";
import { type StatusFinanceiro, type StatusLocacao } from "./rules/maquina-estado";

// Valores `numeric` são lidos como texto (`::text`) para não perder precisão (RN-101).

export type LinhaLocacao = {
  id: string;
  codigo: string;
  status: StatusLocacao;
  statusFinanceiro: StatusFinanceiro;
  fornecedor: string | null;
  centroCusto: string | null;
  pedidosSectra: string | null;
  inicioPrevisto: string | null;
  terminoPrevisto: string | null;
};

/**
 * §5.2: "términos em N dias" = entre hoje e hoje+N (cumulativo); "vencido" =
 * término antes de hoje com saldo ainda sob responsabilidade.
 */
function termino(filtros: FiltrosLocacao, hoje: string) {
  if (filtros.termino === "vencido")
    return { p_termino_ate: somarDias(hoje, -1), p_com_saldo: true };
  if (filtros.termino)
    return { p_termino_de: hoje, p_termino_ate: somarDias(hoje, filtros.termino) };
  return {};
}

export async function buscarLocacoes(contexto: Contexto, filtros: FiltrosLocacao) {
  const supabase = await createSupabaseServerClient();
  const { de } = intervaloPaginacao(filtros.paginacao);
  // "Vence em até N dias" só faz sentido para locações em andamento.
  const status = filtros.status.length
    ? filtros.status
    : filtros.termino
      ? (["ATIVA", "EM_DEVOLUCAO"] as StatusLocacao[])
      : null;
  const { data, error } = await supabase.rpc("buscar_locacoes", {
    p_empresa: contexto.empresa.id,
    ...(filtros.q ? { p_q: termoLiteral(filtros.q) } : {}),
    ...(status ? { p_status: status } : {}),
    ...(filtros.fornecedor ? { p_fornecedor: filtros.fornecedor } : {}),
    ...(filtros.centro ? { p_centro_custo: filtros.centro } : {}),
    ...(filtros.local ? { p_local: filtros.local } : {}),
    ...(filtros.de ? { p_periodo_inicio: filtros.de } : {}),
    ...(filtros.ate ? { p_periodo_fim: filtros.ate } : {}),
    ...termino(filtros, hojeNoFuso(contexto.empresa.timezone)),
    ...(filtros.financeiro.length ? { p_status_financeiro: filtros.financeiro } : {}),
    p_limite: filtros.paginacao.tamanho,
    p_offset: de,
  });
  if (error) throw new Error("Falha ao buscar locações");
  const linhas: LinhaLocacao[] = (data ?? []).map((l) => ({
    id: l.id,
    codigo: l.codigo,
    status: l.status,
    statusFinanceiro: l.status_financeiro,
    fornecedor: l.fornecedor,
    centroCusto: l.centro_custo,
    pedidosSectra: l.pedidos_sectra,
    inicioPrevisto: l.inicio_previsto,
    terminoPrevisto: l.termino_previsto,
  }));
  return { linhas, total: Number(data?.[0]?.total ?? 0) };
}

export type Locacao = {
  id: string;
  codigo: string;
  status: StatusLocacao;
  statusFinanceiro: StatusFinanceiro;
  fornecedorId: string | null;
  fornecedor: string | null;
  centroCustoId: string | null;
  centroCusto: string | null;
  inicioPrevisto: string | null;
  terminoPrevisto: string | null;
  observacoes: string | null;
  ativadaEm: string | null;
  canceladaEm: string | null;
  motivoCancelamento: string | null;
  criadaEm: string;
  inicioEfetivo: string | null;
  desmobilizacaoIniciadaEm: string | null;
  encerradaOperacionalEm: string | null;
  dataEncerramentoFinanceiro: string | null;
  encerradaFinanceiroEm: string | null;
};

export async function obterLocacao(contexto: Contexto, id: string): Promise<Locacao | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("locacoes")
    .select(
      "id, codigo, status, status_financeiro, fornecedor_id, centro_custo_id, inicio_previsto, termino_previsto, observacoes, ativada_em, cancelada_em, motivo_cancelamento, created_at, inicio_efetivo, desmobilizacao_iniciada_em, encerrada_operacional_em, data_encerramento_financeiro, encerrada_financeiro_em, fornecedores(razao_social, nome_fantasia), centros_custo(codigo, nome)",
    )
    .eq("empresa_id", contexto.empresa.id)
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    codigo: data.codigo,
    status: data.status,
    statusFinanceiro: data.status_financeiro,
    fornecedorId: data.fornecedor_id,
    fornecedor: data.fornecedores
      ? (data.fornecedores.nome_fantasia ?? data.fornecedores.razao_social)
      : null,
    centroCustoId: data.centro_custo_id,
    centroCusto: data.centros_custo
      ? `${data.centros_custo.codigo} · ${data.centros_custo.nome}`
      : null,
    inicioPrevisto: data.inicio_previsto,
    terminoPrevisto: data.termino_previsto,
    observacoes: data.observacoes,
    ativadaEm: data.ativada_em,
    canceladaEm: data.cancelada_em,
    motivoCancelamento: data.motivo_cancelamento,
    criadaEm: data.created_at,
    inicioEfetivo: data.inicio_efetivo,
    desmobilizacaoIniciadaEm: data.desmobilizacao_iniciada_em,
    encerradaOperacionalEm: data.encerrada_operacional_em,
    dataEncerramentoFinanceiro: data.data_encerramento_financeiro,
    encerradaFinanceiroEm: data.encerrada_financeiro_em,
  };
}

export type Referencia = {
  id: string;
  sistema: SistemaExterno;
  tipo: TipoReferencia;
  numero: string;
  dataDocumento: string | null;
  observacao: string | null;
};

export async function listarReferencias(
  contexto: Contexto,
  locacaoId: string,
): Promise<Referencia[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("referencias_externas")
    .select("id, sistema, tipo, numero, data_documento, observacao")
    .eq("empresa_id", contexto.empresa.id)
    .eq("locacao_id", locacaoId)
    .order("created_at");
  if (error) throw new Error("Falha ao listar referências");
  return (data ?? []).map((r) => ({
    id: r.id,
    sistema: r.sistema,
    tipo: r.tipo,
    numero: r.numero,
    dataDocumento: r.data_documento,
    observacao: r.observacao,
  }));
}

export type ItemLocacao = {
  id: string;
  categoriaId: string;
  categoria: string;
  descricao: string;
  modoControle: "INDIVIDUAL" | "LOTE";
  quantidadeContratada: string;
  unidade: string;
  valorUnitario: string;
  periodicidade: Periodicidade;
  observacao: string | null;
  recebida: string;
  devolvida: string;
  saldo: string;
};

/** Itens com valores e saldos — exige `valores.ver` (RLS de itens_locacao). */
export async function listarItens(contexto: Contexto, locacaoId: string): Promise<ItemLocacao[]> {
  const supabase = await createSupabaseServerClient();
  const [itens, saldos] = await Promise.all([
    supabase
      .from("itens_locacao")
      .select(
        "id, categoria_id, descricao, modo_controle, quantidade_contratada::text, unidade, valor_unitario::text, periodicidade, observacao, categorias_bem(nome)",
      )
      .eq("empresa_id", contexto.empresa.id)
      .eq("locacao_id", locacaoId)
      .order("created_at"),
    supabase
      .from("v_saldo_item_locacao")
      .select("item_locacao_id, quantidade_recebida::text, quantidade_devolvida::text, saldo::text")
      .eq("empresa_id", contexto.empresa.id)
      .eq("locacao_id", locacaoId),
  ]);
  if (itens.error || saldos.error) throw new Error("Falha ao listar itens");
  const porItem = new Map((saldos.data ?? []).map((s) => [s.item_locacao_id, s]));
  return (itens.data ?? []).map((i) => {
    const s = porItem.get(i.id);
    return {
      id: i.id,
      categoriaId: i.categoria_id,
      categoria: i.categorias_bem?.nome ?? "—",
      descricao: i.descricao,
      modoControle: i.modo_controle,
      quantidadeContratada: i.quantidade_contratada,
      unidade: i.unidade,
      valorUnitario: i.valor_unitario,
      periodicidade: i.periodicidade,
      observacao: i.observacao,
      recebida: s?.quantidade_recebida ?? "0",
      devolvida: s?.quantidade_devolvida ?? "0",
      saldo: s?.saldo ?? "0",
    };
  });
}

export async function pendenciasAtivacao(locacaoId: string): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("pendencias_ativacao_locacao", {
    p_locacao: locacaoId,
  });
  if (error) throw new Error("Falha ao verificar pendências");
  return data ?? [];
}

export async function saldoLocacao(contexto: Contexto, locacaoId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("v_saldo_locacao")
    .select("bens_ativos::text, saldo_lotes::text, a_receber::text")
    .eq("empresa_id", contexto.empresa.id)
    .eq("locacao_id", locacaoId)
    .maybeSingle();
  return data
    ? { bensAtivos: data.bens_ativos, saldoLotes: data.saldo_lotes, aReceber: data.a_receber }
    : null;
}
