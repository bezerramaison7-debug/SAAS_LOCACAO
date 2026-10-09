"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { decimalParaJson } from "@/lib/format/decimal-json";
import { errosDoZod, falha, type EstadoAcao } from "@/lib/actions/estado";
import { type Contexto, exigirContexto } from "@/lib/auth/contexto";
import { traduzirErroBanco } from "@/lib/db/erros";
import { type Permissao } from "@/lib/permissions/matriz";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { justificativaSchema, uuidSchema } from "@/lib/validation/comum";

import { opcoesDevolucao } from "./queries";
import { agendamentoSchema, lerRetirada, lerSolicitacao } from "./schemas";

/**
 * Empresa sempre do contexto; permissão checada aqui (mensagem amigável) e de
 * novo nas funções do banco, que também validam estado, saldo e reservas.
 */
const REVISE = "Revise os campos destacados.";

async function contextoCom(permissao: Permissao): Promise<Contexto | null> {
  const contexto = await exigirContexto();
  return contexto.permissoes.includes(permissao) ? contexto : null;
}
const semPermissao = () => falha("Você não tem permissão para esta ação.");

function id(valor: FormDataEntryValue | null) {
  const r = uuidSchema.safeParse(valor);
  return r.success ? r.data : null;
}

function campos(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    [...formData.entries()].filter((e): e is [string, string] => typeof e[1] === "string"),
  );
}

function revalidar(devolucao: string | null, locacao: string | null) {
  revalidatePath("/devolucoes");
  revalidatePath("/bens");
  if (devolucao) revalidatePath(`/devolucoes/${devolucao}`);
  if (locacao) revalidatePath(`/locacoes/${locacao}`);
}

export async function solicitarDevolucao(
  _anterior: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const contexto = await contextoCom("devolucao.gerenciar");
  if (!contexto) return semPermissao();
  const locacao = id(formData.get("locacaoId"));
  if (!locacao) return falha("Locação inválida.");
  const valores = campos(formData);
  const opcoes = await opcoesDevolucao(contexto, locacao);
  const { itens, erros } = lerSolicitacao(
    valores,
    new Map(opcoes.lotes.map((l) => [l.id, l.disponivel])),
  );
  if (Object.keys(erros).length) return falha(erros._ ?? REVISE, { errosCampo: erros, valores });
  const observacoes = (valores.observacoes ?? "").trim();
  if (observacoes.length > 4000)
    return falha(REVISE, { errosCampo: { observacoes: "Máximo de 4000 caracteres" }, valores });
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("rpc_solicitar_devolucao", {
    p_locacao: locacao,
    p_itens: itens.map((i) =>
      "bem" in i ? i : { lote: i.lote, quantidade: decimalParaJson(i.quantidade) },
    ),
    ...(observacoes ? { p_observacoes: observacoes } : {}),
  });
  if (error || !data) return falha(traduzirErroBanco(error).mensagem, { valores });
  revalidar(data, locacao);
  redirect(`/devolucoes/${data}?solicitada=1`);
}

export async function agendarDevolucao(
  _anterior: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const contexto = await contextoCom("devolucao.gerenciar");
  if (!contexto) return semPermissao();
  const devolucao = id(formData.get("id"));
  if (!devolucao) return falha("Devolução inválida.");
  const valores = { agendadaPara: String(formData.get("agendadaPara") ?? "") };
  const dados = agendamentoSchema(contexto.empresa.timezone).safeParse(valores);
  if (!dados.success) return falha(REVISE, { errosCampo: errosDoZod(dados.error), valores });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_agendar_devolucao", {
    p_devolucao: devolucao,
    p_agendada_para: dados.data.agendadaPara,
  });
  if (error) return falha(traduzirErroBanco(error).mensagem, { valores });
  revalidar(devolucao, null);
  redirect(`/devolucoes/${devolucao}?agendada=1`);
}

export async function iniciarVistoriaSaida(formData: FormData): Promise<EstadoAcao> {
  const contexto = await contextoCom("vistoria.registrar");
  if (!contexto) return semPermissao();
  const item = id(formData.get("itemId"));
  if (!item) return falha("Item inválido.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("rpc_iniciar_vistoria_saida", {
    p_item_devolucao: item,
  });
  if (error || !data) return falha(traduzirErroBanco(error).mensagem);
  redirect(`/vistorias/${data}`);
}

export async function confirmarRetirada(
  _anterior: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const contexto = await contextoCom("devolucao.gerenciar");
  if (!contexto) return semPermissao();
  const devolucao = id(formData.get("id"));
  if (!devolucao) return falha("Devolução inválida.");
  const valores = campos(formData);
  const supabase = await createSupabaseServerClient();
  const { data: itens } = await supabase
    .from("itens_devolucao")
    .select("id, quantidade_solicitada::text")
    .eq("empresa_id", contexto.empresa.id)
    .eq("devolucao_id", devolucao)
    .eq("ativo", true);
  const { dados, erros } = lerRetirada(
    valores,
    contexto.empresa.timezone,
    new Map((itens ?? []).map((i) => [i.id, i.quantidade_solicitada])),
  );
  if (!dados) return falha(erros._ ?? REVISE, { errosCampo: erros, valores });
  const { error } = await supabase.rpc("rpc_confirmar_retirada", {
    p_devolucao: devolucao,
    p_retirada_em: dados.retiradaEm,
    p_recebedor: dados.recebedor,
    p_itens: dados.itens.map((i) => ({
      id: i.id,
      quantidade: decimalParaJson(i.quantidade),
      ...(i.condicao ? { condicao: i.condicao } : {}),
    })),
    p_imediata: valores.imediata === "on",
  });
  if (error) return falha(traduzirErroBanco(error).mensagem, { valores });
  const { data: d } = await supabase
    .from("devolucoes")
    .select("locacao_id")
    .eq("id", devolucao)
    .maybeSingle();
  revalidar(devolucao, d?.locacao_id ?? null);
  redirect(`/devolucoes/${devolucao}?retirada=1`);
}

/** Ações de um clique (conferir, ciência) e cancelamento com motivo. */
async function executar(
  permissao: Permissao,
  formData: FormData,
  chamada: (
    supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
    devolucao: string,
    motivo: string,
  ) => PromiseLike<{ error: { code?: string; message: string } | null }>,
  aviso: string,
  exigeMotivo = false,
): Promise<EstadoAcao> {
  const contexto = await contextoCom(permissao);
  if (!contexto) return semPermissao();
  const devolucao = id(formData.get("id"));
  if (!devolucao) return falha("Devolução inválida.");
  let motivo = "";
  if (exigeMotivo) {
    const m = justificativaSchema.safeParse(formData.get("motivo") ?? "");
    if (!m.success) return falha(m.error.issues[0]?.message ?? "Informe o motivo.");
    motivo = m.data;
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await chamada(supabase, devolucao, motivo);
  if (error) return falha(traduzirErroBanco(error).mensagem);
  revalidar(devolucao, null);
  revalidatePath("/cobrancas");
  redirect(`/devolucoes/${devolucao}?${aviso}=1`);
}

export async function conferirDevolucao(formData: FormData): Promise<EstadoAcao> {
  return executar(
    "devolucao.gerenciar",
    formData,
    (s, d) => s.rpc("rpc_conferir_devolucao", { p_devolucao: d }),
    "conferida",
  );
}

export async function cancelarDevolucao(formData: FormData): Promise<EstadoAcao> {
  return executar(
    "devolucao.gerenciar",
    formData,
    (s, d, motivo) => s.rpc("rpc_cancelar_devolucao", { p_devolucao: d, p_motivo: motivo }),
    "cancelada",
    true,
  );
}

export async function darCiencia(formData: FormData): Promise<EstadoAcao> {
  return executar(
    "devolucao.ciencia_financeira",
    formData,
    (s, d) => s.rpc("rpc_dar_ciencia_devolucao", { p_devolucao: d }),
    "ciencia",
  );
}
