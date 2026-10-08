import "server-only";

import { type Contexto } from "@/lib/auth/contexto";
import { filtroBuscaIlike } from "@/lib/db/busca";
import { intervaloPaginacao, type Paginacao } from "@/lib/validation/comum";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { type Condicao, type StatusRecebimento } from "./rotulos";

// Numéricos lidos como texto (RN-101).

export type FiltrosRecebimento = {
  q: string;
  status: StatusRecebimento | null;
  paginacao: Paginacao;
};

export async function listarRecebimentos(contexto: Contexto, filtros: FiltrosRecebimento) {
  const supabase = await createSupabaseServerClient();
  const { de, ate } = intervaloPaginacao(filtros.paginacao);
  let consulta = supabase
    .from("recebimentos")
    .select("id, codigo, status, data_evento, created_at, locacoes(codigo), locais(nome)", {
      count: "exact",
    })
    .eq("empresa_id", contexto.empresa.id)
    .order("created_at", { ascending: false })
    .range(de, ate);
  if (filtros.status) consulta = consulta.eq("status", filtros.status);
  const busca = filtroBuscaIlike(["codigo"], filtros.q);
  if (busca) consulta = consulta.or(busca);
  const { data, count, error } = await consulta;
  if (error) throw new Error("Falha ao listar recebimentos");
  return {
    linhas: (data ?? []).map((r) => ({
      id: r.id,
      codigo: r.codigo,
      status: r.status,
      dataEvento: r.data_evento,
      criadoEm: r.created_at,
      locacao: r.locacoes?.codigo ?? "—",
      local: r.locais?.nome ?? null,
    })),
    total: count ?? 0,
  };
}

export type Recebimento = {
  id: string;
  codigo: string;
  status: StatusRecebimento;
  locacaoId: string;
  locacaoCodigo: string;
  fornecedor: string | null;
  dataEvento: string | null;
  localId: string | null;
  local: string | null;
  responsavelId: string | null;
  observacoes: string | null;
  criadoPor: string | null;
  confirmadoEm: string | null;
  canceladoEm: string | null;
  motivoCancelamento: string | null;
  excessoJustificativa: string | null;
  excessoAutorizadoEm: string | null;
};

export async function obterRecebimento(
  contexto: Contexto,
  id: string,
): Promise<Recebimento | null> {
  const supabase = await createSupabaseServerClient();
  const { data: r } = await supabase
    .from("recebimentos")
    .select(
      "id, codigo, status, locacao_id, data_evento, local_id, responsavel_id, observacoes, created_by, confirmado_em, cancelado_em, motivo_cancelamento, excesso_justificativa, excesso_autorizado_em, locacoes(codigo, fornecedores(razao_social, nome_fantasia)), locais(nome)",
    )
    .eq("empresa_id", contexto.empresa.id)
    .eq("id", id)
    .maybeSingle();
  if (!r) return null;
  const f = r.locacoes?.fornecedores;
  return {
    id: r.id,
    codigo: r.codigo,
    status: r.status,
    locacaoId: r.locacao_id,
    locacaoCodigo: r.locacoes?.codigo ?? "—",
    fornecedor: f ? (f.nome_fantasia ?? f.razao_social) : null,
    dataEvento: r.data_evento,
    localId: r.local_id,
    local: r.locais?.nome ?? null,
    responsavelId: r.responsavel_id,
    observacoes: r.observacoes,
    criadoPor: r.created_by,
    confirmadoEm: r.confirmado_em,
    canceladoEm: r.cancelado_em,
    motivoCancelamento: r.motivo_cancelamento,
    excessoJustificativa: r.excesso_justificativa,
    excessoAutorizadoEm: r.excesso_autorizado_em,
  };
}

export type ItemContratado = {
  id: string;
  descricao: string;
  categoria: string;
  modoControle: "INDIVIDUAL" | "LOTE";
  unidade: string;
  contratada: string;
  recebida: string;
  exigeNumeroSerie: boolean;
  exigePlaca: boolean;
  exigeIdentFornecedor: boolean;
  temChecklist: boolean;
};

/** Itens da locação com o que já foi recebido (confirmado). */
export async function itensContratados(
  contexto: Contexto,
  locacaoId: string,
): Promise<ItemContratado[]> {
  const supabase = await createSupabaseServerClient();
  const [itens, saldos] = await Promise.all([
    supabase
      .from("itens_locacao")
      .select(
        "id, descricao, modo_controle, unidade, quantidade_contratada::text, categorias_bem(nome, exige_numero_serie, exige_placa, exige_ident_fornecedor, checklist_familia_id)",
      )
      .eq("empresa_id", contexto.empresa.id)
      .eq("locacao_id", locacaoId)
      .order("created_at"),
    supabase
      .from("v_saldo_item_locacao")
      .select("item_locacao_id, quantidade_recebida::text")
      .eq("empresa_id", contexto.empresa.id)
      .eq("locacao_id", locacaoId),
  ]);
  if (itens.error || saldos.error) throw new Error("Falha ao carregar itens da locação");
  const recebida = new Map(
    (saldos.data ?? []).map((s) => [s.item_locacao_id, s.quantidade_recebida]),
  );
  return (itens.data ?? []).map((i) => ({
    id: i.id,
    descricao: i.descricao,
    categoria: i.categorias_bem?.nome ?? "—",
    modoControle: i.modo_controle,
    unidade: i.unidade,
    contratada: i.quantidade_contratada,
    recebida: recebida.get(i.id) ?? "0",
    exigeNumeroSerie: i.categorias_bem?.exige_numero_serie ?? false,
    exigePlaca: i.categorias_bem?.exige_placa ?? false,
    exigeIdentFornecedor: i.categorias_bem?.exige_ident_fornecedor ?? false,
    temChecklist: Boolean(i.categorias_bem?.checklist_familia_id),
  }));
}

export type LinhaRecebimento = {
  id: string;
  itemLocacaoId: string;
  descricao: string;
  modoControle: "INDIVIDUAL" | "LOTE";
  unidade: string;
  quantidade: string;
  condicao: Condicao;
  observacao: string | null;
  bem: {
    id: string;
    codigo: string;
    numeroSerie: string | null;
    placa: string | null;
    identificacaoFornecedor: string | null;
  } | null;
  loteId: string | null;
  loteCodigo: string | null;
};

export async function linhasRecebimento(
  contexto: Contexto,
  recebimentoId: string,
): Promise<LinhaRecebimento[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("itens_recebimento")
    .select(
      "id, item_locacao_id, quantidade::text, condicao, observacao, lote_id, bens(id, codigo, numero_serie, placa, identificacao_fornecedor), lotes(codigo), itens_locacao(descricao, modo_controle, unidade)",
    )
    .eq("empresa_id", contexto.empresa.id)
    .eq("recebimento_id", recebimentoId)
    .order("created_at")
    .order("id");
  if (error) throw new Error("Falha ao carregar itens do recebimento");
  return (data ?? []).map((l) => ({
    id: l.id,
    itemLocacaoId: l.item_locacao_id,
    descricao: l.itens_locacao?.descricao ?? "—",
    modoControle: l.itens_locacao?.modo_controle ?? "LOTE",
    unidade: l.itens_locacao?.unidade ?? "un",
    quantidade: l.quantidade,
    condicao: l.condicao,
    observacao: l.observacao,
    bem: l.bens
      ? {
          id: l.bens.id,
          codigo: l.bens.codigo,
          numeroSerie: l.bens.numero_serie,
          placa: l.bens.placa,
          identificacaoFornecedor: l.bens.identificacao_fornecedor,
        }
      : null,
    loteId: l.lote_id,
    loteCodigo: l.lotes?.codigo ?? null,
  }));
}

/** Vistorias de entrada das linhas (ativa = não cancelada). */
export async function vistoriasDasLinhas(contexto: Contexto, linhas: string[]) {
  if (!linhas.length) return new Map<string, { id: string; status: string }>();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("vistorias")
    .select("id, status, item_recebimento_id")
    .eq("empresa_id", contexto.empresa.id)
    .in("item_recebimento_id", linhas)
    .neq("status", "CANCELADA");
  return new Map(
    (data ?? []).map((v) => [v.item_recebimento_id as string, { id: v.id, status: v.status }]),
  );
}

export async function pendenciasRecebimento(id: string): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("pendencias_recebimento", { p_recebimento: id });
  if (error) throw new Error("Falha ao verificar pendências");
  return data ?? [];
}

export async function excessoRecebimento(id: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("excesso_recebimento", { p_recebimento: id });
  if (error) throw new Error("Falha ao verificar excesso");
  return (data ?? []).map((e) => ({
    descricao: e.descricao,
    contratada: e.contratada,
    jaRecebida: e.ja_recebida,
    agora: e.agora,
    excesso: e.excesso,
  }));
}

/** Membros ativos da empresa (responsável é sempre um usuário associado — RN-32). */
export async function opcoesResponsaveis(contexto: Contexto) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("usuarios_empresa")
    .select("user_id, perfis_usuario(nome)")
    .eq("empresa_id", contexto.empresa.id)
    .eq("ativo", true);
  return (data ?? [])
    .map((u) => ({ id: u.user_id, rotulo: u.perfis_usuario?.nome ?? "Usuário" }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

/** Locações ATIVAS (únicas que aceitam recebimento — RN-20). */
export async function locacoesParaReceber(contexto: Contexto) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("locacoes")
    .select("id, codigo, fornecedores(razao_social, nome_fantasia)")
    .eq("empresa_id", contexto.empresa.id)
    .eq("status", "ATIVA")
    .order("codigo", { ascending: false });
  return (data ?? []).map((l) => ({
    id: l.id,
    rotulo: `${l.codigo} — ${l.fornecedores?.nome_fantasia ?? l.fornecedores?.razao_social ?? "sem fornecedor"}`,
  }));
}
