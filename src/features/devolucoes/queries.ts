import "server-only";

import Decimal from "decimal.js";

import { type Contexto } from "@/lib/auth/contexto";
import { filtroBuscaIlike } from "@/lib/db/busca";
import { intervaloPaginacao, type Paginacao } from "@/lib/validation/comum";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const VISOES_DEVOLUCAO = {
  ABERTAS: { rotulo: "Aguardando retirada", status: ["SOLICITADA", "AGENDADA"] },
  RETIRADAS: { rotulo: "Retiradas (a conferir)", status: ["RETIRADA_CONFIRMADA"] },
  CONFERIDAS: { rotulo: "Conferidas", status: ["CONFERIDA"] },
  CANCELADAS: { rotulo: "Canceladas", status: ["CANCELADA"] },
  TODAS: { rotulo: "Todas", status: [] },
} as const;
export type VisaoDevolucao = keyof typeof VISOES_DEVOLUCAO;

export type FiltrosDevolucao = {
  q: string;
  visao: VisaoDevolucao;
  /** "comprovante": retiradas sem comprovante ativo; "ciencia": sem ciência financeira. */
  pendencia: "comprovante" | "ciencia" | null;
  paginacao: Paginacao;
};

const LOCACAO = "locacoes!devolucoes_empresa_id_locacao_id_fkey(codigo)";

export async function listarDevolucoes(contexto: Contexto, filtros: FiltrosDevolucao) {
  const supabase = await createSupabaseServerClient();
  const { de, ate } = intervaloPaginacao(filtros.paginacao);
  let consulta = supabase
    .from("devolucoes")
    .select(
      `id, codigo, status, locacao_id, solicitada_em, agendada_para, retirada_em, ciencia_financeira_em, comprovante_confirmado, ${LOCACAO}`,
      { count: "exact" },
    )
    .eq("empresa_id", contexto.empresa.id)
    .order("created_at", { ascending: false })
    .range(de, ate);
  const status = VISOES_DEVOLUCAO[filtros.visao].status;
  if (status.length) consulta = consulta.in("status", [...status]);
  if (filtros.pendencia === "ciencia") {
    consulta = consulta.not("retirada_confirmada_em", "is", null).is("ciencia_financeira_em", null);
  }
  if (filtros.pendencia === "comprovante") {
    const semComprovante = await idsSemComprovante(contexto);
    consulta = consulta.in(
      "id",
      semComprovante.length ? semComprovante : ["00000000-0000-0000-0000-000000000000"],
    );
  }
  const busca = filtroBuscaIlike(["codigo", "fornecedor_recebedor"], filtros.q);
  if (busca) consulta = consulta.or(busca);
  const { data, count, error } = await consulta;
  if (error) throw new Error("Falha ao listar devoluções");
  return {
    linhas: (data ?? []).map((d) => ({
      id: d.id,
      codigo: d.codigo,
      status: d.status,
      locacaoId: d.locacao_id,
      locacao: d.locacoes?.codigo ?? "—",
      solicitadaEm: d.solicitada_em,
      agendadaPara: d.agendada_para,
      retiradaEm: d.retirada_em,
      ciencia: Boolean(d.ciencia_financeira_em),
    })),
    total: count ?? 0,
  };
}

/** Devoluções com retirada confirmada e sem comprovante ativo (evidências pendentes). */
async function idsSemComprovante(contexto: Contexto): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const [{ data: retiradas }, { data: comprovantes }] = await Promise.all([
    supabase
      .from("devolucoes")
      .select("id")
      .eq("empresa_id", contexto.empresa.id)
      .in("status", ["RETIRADA_CONFIRMADA", "CONFERIDA"])
      .limit(1000),
    supabase
      .from("evidencias")
      .select("entidade_id")
      .eq("empresa_id", contexto.empresa.id)
      .eq("entidade_tipo", "DEVOLUCAO")
      .eq("tipo", "COMPROVANTE")
      .eq("status", "ATIVA")
      .limit(1000),
  ]);
  const com = new Set((comprovantes ?? []).map((c) => c.entidade_id));
  return (retiradas ?? []).map((d) => d.id).filter((id) => !com.has(id));
}

async function nomes(ids: (string | null)[]) {
  const validos = [...new Set(ids.filter((i): i is string => Boolean(i)))];
  if (!validos.length) return new Map<string, string>();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("perfis_usuario")
    .select("user_id, nome")
    .in("user_id", validos);
  return new Map((data ?? []).map((p) => [p.user_id, p.nome]));
}

export async function obterDevolucao(contexto: Contexto, id: string) {
  const supabase = await createSupabaseServerClient();
  const { data: d } = await supabase
    .from("devolucoes")
    .select(
      `id, codigo, status, locacao_id, observacoes, solicitada_em, solicitada_por, agendada_para, agendada_em,
       retirada_em, retirada_confirmada_em, retirada_confirmada_por, fornecedor_recebedor, conferida_em,
       conferida_por, ciencia_financeira_em, ciencia_financeira_por, cancelada_em, motivo_cancelamento, ${LOCACAO}`,
    )
    .eq("empresa_id", contexto.empresa.id)
    .eq("id", id)
    .maybeSingle();
  if (!d) return null;
  const [{ data: itens }, { data: vistorias }, pessoas] = await Promise.all([
    supabase
      .from("itens_devolucao")
      .select(
        "id, ativo, bem_id, lote_id, quantidade_solicitada::text, quantidade_retirada::text, condicao_saida, bens(codigo, numero_serie), lotes(codigo), itens_locacao(descricao, unidade, categorias_bem(checklist_familia_id))",
      )
      .eq("devolucao_id", d.id)
      .order("created_at"),
    supabase
      .from("vistorias")
      .select("id, status, item_devolucao_id")
      .eq("evento_origem_tipo", "DEVOLUCAO")
      .eq("evento_origem_id", d.id)
      .neq("status", "CANCELADA"),
    nomes([d.solicitada_por, d.retirada_confirmada_por, d.conferida_por, d.ciencia_financeira_por]),
  ]);
  const vistoriaDe = new Map((vistorias ?? []).map((v) => [v.item_devolucao_id, v]));
  const nome = (u: string | null) => (u ? (pessoas.get(u) ?? "Usuário") : null);
  return {
    id: d.id,
    codigo: d.codigo,
    status: d.status,
    locacaoId: d.locacao_id,
    locacao: d.locacoes?.codigo ?? "—",
    observacoes: d.observacoes,
    solicitadaEm: d.solicitada_em,
    solicitadaPor: nome(d.solicitada_por),
    agendadaPara: d.agendada_para,
    retiradaEm: d.retirada_em,
    retiradaConfirmadaPor: nome(d.retirada_confirmada_por),
    recebedor: d.fornecedor_recebedor,
    conferidaEm: d.conferida_em,
    conferidaPor: nome(d.conferida_por),
    cienciaEm: d.ciencia_financeira_em,
    cienciaPor: nome(d.ciencia_financeira_por),
    canceladaEm: d.cancelada_em,
    motivoCancelamento: d.motivo_cancelamento,
    itens: (itens ?? []).map((i) => {
      const v = vistoriaDe.get(i.id);
      return {
        id: i.id,
        ativo: i.ativo,
        bemId: i.bem_id,
        loteId: i.lote_id,
        rotulo: i.bens
          ? `${i.bens.codigo}${i.bens.numero_serie ? ` (${i.bens.numero_serie})` : ""}`
          : (i.lotes?.codigo ?? "—"),
        descricao: i.itens_locacao?.descricao ?? "",
        unidade: i.itens_locacao?.unidade ?? "",
        solicitada: i.quantidade_solicitada,
        retirada: i.quantidade_retirada,
        condicao: i.condicao_saida,
        exigeVistoria: Boolean(i.itens_locacao?.categorias_bem?.checklist_familia_id),
        vistoria: v ? { id: v.id, concluida: v.status === "CONCLUIDA" } : null,
      };
    }),
  };
}
export type Devolucao = NonNullable<Awaited<ReturnType<typeof obterDevolucao>>>;

/**
 * O que ainda pode ser devolvido na locação: bens DISPONIVEL/EM_USO e lotes
 * ativos com saldo − reservas de devoluções abertas (RN-52).
 */
export async function opcoesDevolucao(contexto: Contexto, locacaoId: string) {
  const supabase = await createSupabaseServerClient();
  const [{ data: bens }, { data: lotes }, { data: reservas }] = await Promise.all([
    supabase
      .from("bens")
      .select(
        "id, codigo, status, numero_serie, placa, locais(nome), itens_locacao!inner(descricao, locacao_id)",
      )
      .eq("empresa_id", contexto.empresa.id)
      .eq("itens_locacao.locacao_id", locacaoId)
      .in("status", ["DISPONIVEL", "EM_USO"])
      .order("codigo"),
    supabase
      .from("lotes")
      .select(
        "id, codigo, saldo::text, locais(nome), itens_locacao!inner(descricao, unidade, locacao_id)",
      )
      .eq("empresa_id", contexto.empresa.id)
      .eq("itens_locacao.locacao_id", locacaoId)
      .eq("status", "ATIVO")
      .order("codigo"),
    supabase
      .from("itens_devolucao")
      .select("lote_id, quantidade_solicitada::text, devolucoes!inner(status)")
      .eq("empresa_id", contexto.empresa.id)
      .eq("ativo", true)
      .not("lote_id", "is", null)
      .in("devolucoes.status", ["RASCUNHO", "SOLICITADA", "AGENDADA"]),
  ]);
  const reservado = new Map<string, Decimal>();
  for (const r of reservas ?? []) {
    if (!r.lote_id) continue;
    reservado.set(
      r.lote_id,
      (reservado.get(r.lote_id) ?? new Decimal(0)).plus(r.quantidade_solicitada),
    );
  }
  return {
    bens: (bens ?? []).map((b) => ({
      id: b.id,
      codigo: b.codigo,
      identificacao: b.numero_serie ?? b.placa,
      descricao: b.itens_locacao.descricao,
      local: b.locais?.nome ?? null,
    })),
    lotes: (lotes ?? [])
      .map((l) => ({
        id: l.id,
        codigo: l.codigo,
        descricao: l.itens_locacao.descricao,
        unidade: l.itens_locacao.unidade,
        local: l.locais?.nome ?? null,
        disponivel: new Decimal(l.saldo).minus(reservado.get(l.id) ?? 0).toString(),
      }))
      .filter((l) => new Decimal(l.disponivel).gt(0)),
  };
}
