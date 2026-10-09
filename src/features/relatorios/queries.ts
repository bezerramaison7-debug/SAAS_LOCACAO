import "server-only";

import { type Contexto } from "@/lib/auth/contexto";
import { formatarDataCivil } from "@/lib/format/datas";
import { intervaloPaginacao, type Paginacao } from "@/lib/validation/comum";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const COLUNAS =
  "id, codigo, tipo, status, parametros, versao_template, hash_dados, hash_arquivo, assinatura_hmac, tentativas, erro, created_at, iniciado_em, concluido_em, solicitado_por";

/** RLS: quem pediu (ou quem lê auditoria) vê o relatório. */
export async function listarRelatorios(contexto: Contexto, paginacao: Paginacao) {
  const supabase = await createSupabaseServerClient();
  const { de, ate } = intervaloPaginacao(paginacao);
  const { data, count, error } = await supabase
    .from("relatorios")
    .select(COLUNAS, { count: "exact" })
    .eq("empresa_id", contexto.empresa.id)
    .order("created_at", { ascending: false })
    .range(de, ate);
  if (error) throw new Error("Falha ao listar relatórios");
  return { linhas: await comAlvos(contexto, data ?? []), total: count ?? 0 };
}

export async function obterRelatorio(contexto: Contexto, id: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("relatorios")
    .select(COLUNAS)
    .eq("empresa_id", contexto.empresa.id)
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const [r] = await comAlvos(contexto, [data]);
  return r ?? null;
}

type Linha = { tipo: string; parametros: unknown } & Record<string, unknown>;

/** Descreve o alvo (código da locação/bem, nome do local, período). */
async function comAlvos<T extends Linha>(contexto: Contexto, linhas: T[]) {
  const supabase = await createSupabaseServerClient();
  const alvo = (l: T) => {
    const p = (l.parametros ?? {}) as { alvo?: string; inicio?: string; fim?: string };
    return p;
  };
  const ids = (tipo: string) =>
    linhas
      .filter((l) => l.tipo === tipo)
      .map((l) => alvo(l).alvo)
      .filter((v): v is string => Boolean(v));
  const [locacoes, bens, locais] = await Promise.all([
    ids("LOCACAO").length
      ? supabase
          .from("locacoes")
          .select("id, codigo")
          .eq("empresa_id", contexto.empresa.id)
          .in("id", ids("LOCACAO"))
      : Promise.resolve({ data: [] }),
    ids("BEM").length
      ? supabase
          .from("bens")
          .select("id, codigo")
          .eq("empresa_id", contexto.empresa.id)
          .in("id", ids("BEM"))
      : Promise.resolve({ data: [] }),
    ids("LOCAL").length
      ? supabase
          .from("locais")
          .select("id, nome")
          .eq("empresa_id", contexto.empresa.id)
          .in("id", ids("LOCAL"))
      : Promise.resolve({ data: [] }),
  ]);
  const nome = new Map<string, string>([
    ...(locacoes.data ?? []).map((l) => [l.id, l.codigo] as [string, string]),
    ...(bens.data ?? []).map((b) => [b.id, b.codigo] as [string, string]),
    ...(locais.data ?? []).map((l) => [l.id, l.nome] as [string, string]),
  ]);
  return linhas.map((l) => {
    const p = alvo(l);
    return {
      ...l,
      alvoDescricao:
        l.tipo === "PERIODO"
          ? `${p.inicio ? formatarDataCivil(p.inicio) : "?"} a ${p.fim ? formatarDataCivil(p.fim) : "?"}`
          : (nome.get(p.alvo ?? "") ?? "—"),
      alvoId: p.alvo ?? null,
    };
  });
}
