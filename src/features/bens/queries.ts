import "server-only";

import { type Contexto } from "@/lib/auth/contexto";
import { filtroBuscaIlike } from "@/lib/db/busca";
import { intervaloPaginacao, type Paginacao } from "@/lib/validation/comum";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FiltrosBens = {
  q: string;
  local: string | null;
  /** "Meus itens": só o que está sob responsabilidade do usuário logado. */
  meus: boolean;
  /** "ativos": ainda sob responsabilidade da empresa (§5.1). */
  situacao: "ativos" | null;
  paginacao: Paginacao;
};

/** Bens visíveis pela RLS (RESPONSAVEL_LOCAL vê só os seus). */
const STATUS_BEM_ATIVO = [
  "DISPONIVEL",
  "EM_USO",
  "EM_TRANSFERENCIA",
  "EM_MANUTENCAO",
  "DEVOLUCAO_SOLICITADA",
  "EXTRAVIADO",
] as const;

export async function listarBens(contexto: Contexto, filtros: FiltrosBens) {
  const supabase = await createSupabaseServerClient();
  const { de, ate } = intervaloPaginacao(filtros.paginacao);
  let consulta = supabase
    .from("bens")
    .select("id, codigo, status, numero_serie, placa, identificacao_fornecedor, locais(nome)", {
      count: "exact",
    })
    .eq("empresa_id", contexto.empresa.id)
    .neq("status", "AGUARDANDO_RECEBIMENTO")
    .neq("status", "CANCELADO")
    .order("codigo", { ascending: false })
    .range(de, ate);
  if (filtros.local) consulta = consulta.eq("local_atual_id", filtros.local);
  if (filtros.meus) consulta = consulta.eq("responsavel_atual_id", contexto.usuario.id);
  if (filtros.situacao) consulta = consulta.in("status", [...STATUS_BEM_ATIVO]);
  const busca = filtroBuscaIlike(
    ["codigo", "numero_serie", "placa", "identificacao_fornecedor"],
    filtros.q,
  );
  if (busca) consulta = consulta.or(busca);
  const { data, count, error } = await consulta;
  if (error) throw new Error("Falha ao listar bens");
  return {
    linhas: (data ?? []).map((b) => ({
      id: b.id,
      codigo: b.codigo,
      status: b.status,
      identificacao: b.numero_serie ?? b.placa ?? b.identificacao_fornecedor,
      local: b.locais?.nome ?? null,
    })),
    total: count ?? 0,
  };
}

export async function listarLotes(contexto: Contexto, filtros: FiltrosBens) {
  const supabase = await createSupabaseServerClient();
  const { de, ate } = intervaloPaginacao(filtros.paginacao);
  let consulta = supabase
    .from("lotes")
    .select("id, codigo, status, saldo::text, locais(nome)", { count: "exact" })
    .eq("empresa_id", contexto.empresa.id)
    .neq("status", "CANCELADO")
    .order("codigo", { ascending: false })
    .range(de, ate);
  if (filtros.local) consulta = consulta.eq("local_atual_id", filtros.local);
  if (filtros.meus) consulta = consulta.eq("responsavel_atual_id", contexto.usuario.id);
  if (filtros.situacao) consulta = consulta.eq("status", "ATIVO");
  const busca = filtroBuscaIlike(["codigo"], filtros.q);
  if (busca) consulta = consulta.or(busca);
  const { data, count, error } = await consulta;
  if (error) throw new Error("Falha ao listar lotes");
  return {
    linhas: (data ?? []).map((l) => ({
      id: l.id,
      codigo: l.codigo,
      status: l.status,
      saldo: l.saldo,
      local: l.locais?.nome ?? null,
    })),
    total: count ?? 0,
  };
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

export async function obterBem(contexto: Contexto, id: string) {
  const supabase = await createSupabaseServerClient();
  const { data: b } = await supabase
    .from("bens")
    .select(
      "id, codigo, status, numero_serie, placa, identificacao_fornecedor, observacoes, responsavel_atual_id, recebimento_id, item_locacao_id, substitui_bem_id, locais(nome), recebimentos(codigo, data_evento, locacao_id, locacoes(codigo)), itens_locacao(descricao, locacao_id, locacoes(codigo), categorias_bem(checklist_familia_id))",
    )
    .eq("empresa_id", contexto.empresa.id)
    .eq("id", id)
    .maybeSingle();
  if (!b) return null;
  const pessoas = await nomes([b.responsavel_atual_id]);
  return {
    id: b.id,
    codigo: b.codigo,
    status: b.status,
    numeroSerie: b.numero_serie,
    placa: b.placa,
    identificacaoFornecedor: b.identificacao_fornecedor,
    observacoes: b.observacoes,
    local: b.locais?.nome ?? null,
    responsavel: b.responsavel_atual_id ? (pessoas.get(b.responsavel_atual_id) ?? "Usuário") : null,
    recebimento: b.recebimento_id
      ? {
          id: b.recebimento_id,
          codigo: b.recebimentos?.codigo ?? "—",
          dataEvento: b.recebimentos?.data_evento ?? null,
        }
      : null,
    // Via item: o bem substituto não tem recebimento próprio (RN-42).
    locacao: b.itens_locacao
      ? { id: b.itens_locacao.locacao_id, codigo: b.itens_locacao.locacoes?.codigo ?? "—" }
      : null,
    item: b.itens_locacao?.descricao ?? "",
    temChecklist: Boolean(b.itens_locacao?.categorias_bem?.checklist_familia_id),
    substituiBemId: b.substitui_bem_id,
  };
}

export async function obterLote(contexto: Contexto, id: string) {
  const supabase = await createSupabaseServerClient();
  const { data: l } = await supabase
    .from("lotes")
    .select(
      "id, codigo, status, saldo::text, quantidade_recebida::text, quantidade_devolvida::text, quantidade_baixada::text, responsavel_atual_id, recebimento_id, lote_origem_id, locais(nome), recebimentos(codigo, data_evento, locacao_id, locacoes(codigo)), itens_locacao(descricao, unidade, locacao_id, locacoes(codigo), categorias_bem(checklist_familia_id))",
    )
    .eq("empresa_id", contexto.empresa.id)
    .eq("id", id)
    .maybeSingle();
  if (!l) return null;
  const pessoas = await nomes([l.responsavel_atual_id]);
  return {
    id: l.id,
    codigo: l.codigo,
    status: l.status,
    saldo: l.saldo,
    recebida: l.quantidade_recebida,
    devolvida: l.quantidade_devolvida,
    local: l.locais?.nome ?? null,
    responsavel: pessoas.get(l.responsavel_atual_id) ?? "Usuário",
    recebimento: l.recebimento_id
      ? {
          id: l.recebimento_id,
          codigo: l.recebimentos?.codigo ?? "—",
          dataEvento: l.recebimentos?.data_evento ?? null,
        }
      : null,
    // Via item: lote de divisão não tem recebimento próprio (RN-34).
    locacao: l.itens_locacao
      ? { id: l.itens_locacao.locacao_id, codigo: l.itens_locacao.locacoes?.codigo ?? "—" }
      : null,
    item: l.itens_locacao?.descricao ?? "",
    unidade: l.itens_locacao?.unidade ?? "",
    baixada: l.quantidade_baixada,
    loteOrigemId: l.lote_origem_id,
    temChecklist: Boolean(l.itens_locacao?.categorias_bem?.checklist_familia_id),
  };
}

/** Vistorias do bem ou do lote (mais recentes primeiro). */
export async function vistoriasDe(contexto: Contexto, alvo: { bem?: string; lote?: string }) {
  const supabase = await createSupabaseServerClient();
  let consulta = supabase
    .from("vistorias")
    .select("id, tipo, status, data_evento, modelos_checklist(nome, versao)")
    .eq("empresa_id", contexto.empresa.id)
    .neq("status", "CANCELADA")
    .order("data_evento", { ascending: false });
  consulta = alvo.bem ? consulta.eq("bem_id", alvo.bem) : consulta.eq("lote_id", alvo.lote ?? "");
  const { data } = await consulta;
  return (data ?? []).map((v) => ({
    id: v.id,
    tipo: v.tipo,
    status: v.status,
    dataEvento: v.data_evento,
    checklist: v.modelos_checklist
      ? `${v.modelos_checklist.nome} v${v.modelos_checklist.versao}`
      : "—",
  }));
}
