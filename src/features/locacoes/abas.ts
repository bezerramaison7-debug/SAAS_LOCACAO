import "server-only";

import { type Contexto } from "@/lib/auth/contexto";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Dados das abas do detalhe. Cada consulta passa pela RLS de quem acessa; as
 * abas com valores/auditoria também são escondidas na interface por permissão.
 * Valores `numeric` lidos como texto (RN-101).
 */

const LIMITE = 200;

export async function recebimentosDaLocacao(contexto: Contexto, locacaoId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("recebimentos")
    .select("id, codigo, status, data_evento, confirmado_em, locais(nome)")
    .eq("empresa_id", contexto.empresa.id)
    .eq("locacao_id", locacaoId)
    .order("created_at", { ascending: false })
    .limit(LIMITE);
  if (error) throw new Error("Falha ao listar recebimentos");
  return (data ?? []).map((r) => ({
    id: r.id,
    codigo: r.codigo,
    status: r.status,
    dataEvento: r.data_evento,
    confirmadoEm: r.confirmado_em,
    local: r.locais?.nome ?? null,
  }));
}

/** Bens e lotes chegam à locação pelo item contratado (exige leitura dos itens). */
export async function bensELotesDaLocacao(contexto: Contexto, locacaoId: string) {
  const supabase = await createSupabaseServerClient();
  const [bens, lotes] = await Promise.all([
    supabase
      .from("bens")
      .select(
        "id, codigo, status, numero_serie, placa, locais(nome), itens_locacao!inner(locacao_id, descricao)",
      )
      .eq("empresa_id", contexto.empresa.id)
      .eq("itens_locacao.locacao_id", locacaoId)
      .order("codigo")
      .limit(LIMITE),
    supabase
      .from("lotes")
      .select(
        "id, codigo, status, saldo::text, locais(nome), itens_locacao!inner(locacao_id, descricao, unidade)",
      )
      .eq("empresa_id", contexto.empresa.id)
      .eq("itens_locacao.locacao_id", locacaoId)
      .order("codigo")
      .limit(LIMITE),
  ]);
  if (bens.error || lotes.error) throw new Error("Falha ao listar bens e lotes");
  return {
    bens: (bens.data ?? []).map((b) => ({
      id: b.id,
      codigo: b.codigo,
      status: b.status,
      identificacao: b.numero_serie ?? b.placa ?? null,
      local: b.locais?.nome ?? null,
      item: b.itens_locacao.descricao,
    })),
    lotes: (lotes.data ?? []).map((l) => ({
      id: l.id,
      codigo: l.codigo,
      status: l.status,
      saldo: l.saldo,
      unidade: l.itens_locacao.unidade,
      local: l.locais?.nome ?? null,
      item: l.itens_locacao.descricao,
    })),
  };
}

export async function movimentacoesDaLocacao(
  contexto: Contexto,
  bemIds: string[],
  loteIds: string[],
) {
  if (!bemIds.length && !loteIds.length) return [];
  const supabase = await createSupabaseServerClient();
  const filtros = [
    ...(bemIds.length ? [`bem_id.in.(${bemIds.join(",")})`] : []),
    ...(loteIds.length ? [`lote_id.in.(${loteIds.join(",")})`] : []),
  ];
  const { data, error } = await supabase
    .from("movimentacoes")
    .select(
      "id, codigo, status, data_evento, origem_local_id, destino_local_id, bens(codigo), lotes!movimentacoes_empresa_id_lote_id_fkey(codigo)",
    )
    .eq("empresa_id", contexto.empresa.id)
    .or(filtros.join(","))
    .order("data_evento", { ascending: false })
    .limit(LIMITE);
  if (error) throw new Error("Falha ao listar movimentações");
  const linhas = data ?? [];
  const idsLocais = [...new Set(linhas.flatMap((m) => [m.origem_local_id, m.destino_local_id]))];
  const { data: locais } = idsLocais.length
    ? await supabase
        .from("locais")
        .select("id, nome")
        .eq("empresa_id", contexto.empresa.id)
        .in("id", idsLocais)
    : { data: [] };
  const nome = new Map((locais ?? []).map((l) => [l.id, l.nome]));
  return linhas.map((m) => ({
    id: m.id,
    codigo: m.codigo,
    status: m.status,
    dataEvento: m.data_evento,
    alvo: m.bens?.codigo ?? m.lotes?.codigo ?? "—",
    origem: nome.get(m.origem_local_id) ?? "—",
    destino: nome.get(m.destino_local_id) ?? "—",
  }));
}

/** Documentos anexados diretamente à locação (contrato, aditivos etc.). */
export async function evidenciasDaLocacao(contexto: Contexto, locacaoId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("evidencias")
    .select("id, tipo, nome_original, legenda, enviada_em, status")
    .eq("empresa_id", contexto.empresa.id)
    .eq("entidade_tipo", "LOCACAO")
    .eq("entidade_id", locacaoId)
    .order("enviada_em", { ascending: false })
    .limit(LIMITE);
  if (error) throw new Error("Falha ao listar evidências");
  return (data ?? []).map((e) => ({
    id: e.id,
    tipo: e.tipo,
    nome: e.nome_original ?? e.legenda ?? "Arquivo",
    enviadaEm: e.enviada_em,
    status: e.status,
  }));
}

export async function devolucoesDaLocacao(contexto: Contexto, locacaoId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("devolucoes")
    .select("id, codigo, status, solicitada_em, agendada_para, retirada_em")
    .eq("empresa_id", contexto.empresa.id)
    .eq("locacao_id", locacaoId)
    .order("created_at", { ascending: false })
    .limit(LIMITE);
  if (error) throw new Error("Falha ao listar devoluções");
  return (data ?? []).map((d) => ({
    id: d.id,
    codigo: d.codigo,
    status: d.status,
    solicitadaEm: d.solicitada_em,
    agendadaPara: d.agendada_para,
    retiradaEm: d.retirada_em,
  }));
}

/** Exige `valores.ver` (RLS de cobrancas). */
export async function cobrancasDaLocacao(contexto: Contexto, locacaoId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("cobrancas")
    .select(
      "id, codigo, status, competencia_inicio, competencia_fim, valor_cobrado::text, numero_documento",
    )
    .eq("empresa_id", contexto.empresa.id)
    .eq("locacao_id", locacaoId)
    .order("competencia_inicio", { ascending: false })
    .limit(LIMITE);
  if (error) throw new Error("Falha ao listar cobranças");
  return (data ?? []).map((c) => ({
    id: c.id,
    codigo: c.codigo,
    status: c.status,
    competenciaInicio: c.competencia_inicio,
    competenciaFim: c.competencia_fim,
    valor: c.valor_cobrado,
    documento: c.numero_documento,
  }));
}

/**
 * Trilha de auditoria da locação e dos registros filhos (itens, referências),
 * identificados por `locacao_id` no snapshot. Exige `auditoria.ler` (RLS).
 */
export async function historicoDaLocacao(contexto: Contexto, locacaoId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("auditoria")
    .select("id, acao, ator_id, created_at, contexto")
    .eq("empresa_id", contexto.empresa.id)
    .or(
      `entidade_id.eq.${locacaoId},dados_novos->>locacao_id.eq.${locacaoId},dados_anteriores->>locacao_id.eq.${locacaoId}`,
    )
    .order("id", { ascending: false })
    .limit(LIMITE);
  if (error) throw new Error("Falha ao carregar histórico");
  const linhas = data ?? [];
  const atores = [...new Set(linhas.map((l) => l.ator_id).filter((a): a is string => a !== null))];
  const { data: perfis } = atores.length
    ? await supabase.from("perfis_usuario").select("user_id, nome").in("user_id", atores)
    : { data: [] };
  const nome = new Map((perfis ?? []).map((p) => [p.user_id, p.nome]));
  return linhas.map((l) => {
    const ctx = (l.contexto ?? {}) as Record<string, unknown>;
    return {
      id: l.id,
      acao: l.acao,
      ator: l.ator_id ? (nome.get(l.ator_id) ?? "Usuário") : "Sistema",
      em: l.created_at,
      motivo: typeof ctx.motivo === "string" ? ctx.motivo : null,
    };
  });
}
