import "server-only";

import { type Contexto } from "@/lib/auth/contexto";
import { intervaloPaginacao, type Paginacao } from "@/lib/validation/comum";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type StatusMovimentacao = "PENDENTE_ACEITE" | "CONFIRMADA" | "RECUSADA" | "CANCELADA";

const COLUNAS =
  "id, codigo, status, data_evento, motivo, quantidade::text, bem_id, lote_id, lote_destino_id, origem_local_id, destino_local_id, responsavel_anterior_id, novo_responsavel_id, created_by, confirmada_em, aceite_administrativo, justificativa_aceite_administrativo, recusada_em, motivo_recusa, cancelada_em, corrige_movimentacao_id, bens(codigo), lotes!movimentacoes_empresa_id_lote_id_fkey(codigo)";

type Linha = {
  id: string;
  codigo: string;
  status: StatusMovimentacao;
  data_evento: string;
  motivo: string;
  quantidade: string | null;
  bem_id: string | null;
  lote_id: string | null;
  lote_destino_id: string | null;
  origem_local_id: string;
  destino_local_id: string;
  responsavel_anterior_id: string;
  novo_responsavel_id: string;
  created_by: string | null;
  confirmada_em: string | null;
  aceite_administrativo: boolean;
  justificativa_aceite_administrativo: string | null;
  recusada_em: string | null;
  motivo_recusa: string | null;
  cancelada_em: string | null;
  corrige_movimentacao_id: string | null;
  bens: { codigo: string } | null;
  lotes: { codigo: string } | null;
};

export type Movimentacao = ReturnType<typeof paraMovimentacao>;

function paraMovimentacao(m: Linha, locais: Map<string, string>, pessoas: Map<string, string>) {
  return {
    id: m.id,
    codigo: m.codigo,
    status: m.status,
    dataEvento: m.data_evento,
    motivo: m.motivo,
    quantidade: m.quantidade,
    bemId: m.bem_id,
    loteId: m.lote_id,
    loteDestinoId: m.lote_destino_id,
    alvo: m.bens?.codigo ?? m.lotes?.codigo ?? "—",
    origem: locais.get(m.origem_local_id) ?? "—",
    destino: locais.get(m.destino_local_id) ?? "—",
    responsavelAnterior: pessoas.get(m.responsavel_anterior_id) ?? "Usuário",
    novoResponsavel: pessoas.get(m.novo_responsavel_id) ?? "Usuário",
    novoResponsavelId: m.novo_responsavel_id,
    criadoPor: m.created_by,
    confirmadaEm: m.confirmada_em,
    aceiteAdministrativo: m.aceite_administrativo,
    justificativaAdministrativa: m.justificativa_aceite_administrativo,
    recusadaEm: m.recusada_em,
    motivoRecusa: m.motivo_recusa,
    canceladaEm: m.cancelada_em,
    corrige: m.corrige_movimentacao_id,
  };
}

async function enriquecer(contexto: Contexto, linhas: Linha[]) {
  const supabase = await createSupabaseServerClient();
  const idsLocais = [...new Set(linhas.flatMap((m) => [m.origem_local_id, m.destino_local_id]))];
  const idsPessoas = [
    ...new Set(linhas.flatMap((m) => [m.responsavel_anterior_id, m.novo_responsavel_id])),
  ];
  const [{ data: locais }, { data: pessoas }] = await Promise.all([
    idsLocais.length
      ? supabase
          .from("locais")
          .select("id, nome")
          .eq("empresa_id", contexto.empresa.id)
          .in("id", idsLocais)
      : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
    idsPessoas.length
      ? supabase.from("perfis_usuario").select("user_id, nome").in("user_id", idsPessoas)
      : Promise.resolve({ data: [] as { user_id: string; nome: string }[] }),
  ]);
  const mapaLocais = new Map((locais ?? []).map((l) => [l.id, l.nome]));
  const mapaPessoas = new Map((pessoas ?? []).map((p) => [p.user_id, p.nome]));
  return linhas.map((m) => paraMovimentacao(m, mapaLocais, mapaPessoas));
}

export async function listarMovimentacoes(
  contexto: Contexto,
  filtros: { status: StatusMovimentacao | null; paraMim?: boolean; paginacao: Paginacao },
) {
  const supabase = await createSupabaseServerClient();
  const { de, ate } = intervaloPaginacao(filtros.paginacao);
  let consulta = supabase
    .from("movimentacoes")
    .select(COLUNAS, { count: "exact" })
    .eq("empresa_id", contexto.empresa.id)
    .order("data_evento", { ascending: false })
    .range(de, ate);
  if (filtros.status) consulta = consulta.eq("status", filtros.status);
  // "Para mim": destinadas ao usuário (pendências de aceite do responsável local — §5.2).
  if (filtros.paraMim) consulta = consulta.eq("novo_responsavel_id", contexto.usuario.id);
  const { data, count, error } = await consulta;
  if (error) throw new Error("Falha ao listar movimentações");
  return { linhas: await enriquecer(contexto, data ?? []), total: count ?? 0 };
}

/** Transferências que aguardam o aceite do usuário atual (F6.2). */
export async function aguardandoMeuAceite(contexto: Contexto) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("movimentacoes")
    .select(COLUNAS)
    .eq("empresa_id", contexto.empresa.id)
    .eq("status", "PENDENTE_ACEITE")
    .eq("novo_responsavel_id", contexto.usuario.id)
    .order("data_evento");
  if (error) throw new Error("Falha ao listar pendências de aceite");
  return enriquecer(contexto, data ?? []);
}

export async function obterMovimentacao(contexto: Contexto, id: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("movimentacoes")
    .select(COLUNAS)
    .eq("empresa_id", contexto.empresa.id)
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const [m] = await enriquecer(contexto, [data]);
  return m ?? null;
}

export type AlvoMovimentacao = {
  tipo: "bem" | "lote";
  id: string;
  codigo: string;
  descricao: string;
  status: string;
  localId: string | null;
  local: string | null;
  responsavelId: string | null;
  saldo: string | null;
  unidade: string | null;
  ultimaConfirmada: string | null;
};

/** Dados do bem/lote para o formulário (RLS de quem consulta). */
export async function obterAlvo(
  contexto: Contexto,
  alvo: { bem?: string; lote?: string },
): Promise<AlvoMovimentacao | null> {
  const supabase = await createSupabaseServerClient();
  const ultima = async (filtro: string) => {
    const { data } = await supabase
      .from("movimentacoes")
      .select("id")
      .eq("empresa_id", contexto.empresa.id)
      .eq("status", "CONFIRMADA")
      .or(filtro)
      .order("data_evento", { ascending: false })
      .limit(1);
    return data?.[0]?.id ?? null;
  };
  if (alvo.bem) {
    const { data: b } = await supabase
      .from("bens")
      .select(
        "id, codigo, status, local_atual_id, responsavel_atual_id, locais(nome), itens_locacao(descricao)",
      )
      .eq("empresa_id", contexto.empresa.id)
      .eq("id", alvo.bem)
      .maybeSingle();
    if (!b) return null;
    return {
      tipo: "bem",
      id: b.id,
      codigo: b.codigo,
      descricao: b.itens_locacao?.descricao ?? "",
      status: b.status,
      localId: b.local_atual_id,
      local: b.locais?.nome ?? null,
      responsavelId: b.responsavel_atual_id,
      saldo: null,
      unidade: null,
      ultimaConfirmada: await ultima(`bem_id.eq.${b.id}`),
    };
  }
  if (alvo.lote) {
    const { data: l } = await supabase
      .from("lotes")
      .select(
        "id, codigo, status, saldo::text, local_atual_id, responsavel_atual_id, locais(nome), itens_locacao(descricao, unidade)",
      )
      .eq("empresa_id", contexto.empresa.id)
      .eq("id", alvo.lote)
      .maybeSingle();
    if (!l) return null;
    return {
      tipo: "lote",
      id: l.id,
      codigo: l.codigo,
      descricao: l.itens_locacao?.descricao ?? "",
      status: l.status,
      localId: l.local_atual_id,
      local: l.locais?.nome ?? null,
      responsavelId: l.responsavel_atual_id,
      saldo: l.saldo,
      unidade: l.itens_locacao?.unidade ?? null,
      ultimaConfirmada: await ultima(`lote_id.eq.${l.id},lote_destino_id.eq.${l.id}`),
    };
  }
  return null;
}
