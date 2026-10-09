"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { camposTexto, errosDoZod, falha, type EstadoAcao } from "@/lib/actions/estado";
import { exigirContexto } from "@/lib/auth/contexto";
import { traduzirErroBanco } from "@/lib/db/erros";
import { decimalParaJson } from "@/lib/format/decimal-json";
import { justificativaSchema, uuidSchema } from "@/lib/validation/comum";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { CAMPOS_MOVIMENTACAO, movimentacaoSchema } from "./schemas";

const id = (v: FormDataEntryValue | null) => {
  const r = uuidSchema.safeParse(v);
  return r.success ? r.data : null;
};

function revalidarAlvo(bem: string | null, lote: string | null) {
  revalidatePath("/movimentacoes");
  revalidatePath("/bens");
  if (bem) revalidatePath(`/bens/${bem}`);
  if (lote) revalidatePath(`/bens/lotes/${lote}`);
}

/** Registra a movimentação; o banco decide se confirma na hora ou aguarda aceite (RN-33). */
export async function registrarMovimentacao(
  _anterior: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const contexto = await exigirContexto();
  if (!contexto.permissoes.includes("movimentacao.registrar")) {
    return falha("Você não tem permissão para registrar movimentações.");
  }
  const bem = id(formData.get("bemId"));
  const lote = id(formData.get("loteId"));
  const corrige = id(formData.get("corrigeId"));
  if (!bem === !lote) return falha("Item inválido.");
  const entrada = camposTexto(formData, CAMPOS_MOVIMENTACAO);
  const dados = movimentacaoSchema(contexto.empresa.timezone).safeParse(entrada);
  if (!dados.success)
    return falha("Revise os campos destacados.", {
      errosCampo: errosDoZod(dados.error),
      valores: entrada,
    });
  const d = dados.data;
  if (d.correcao && !corrige)
    return falha("Não há movimentação confirmada para corrigir.", { valores: entrada });
  const supabase = await createSupabaseServerClient();
  const { data: novo, error } = await supabase.rpc("rpc_registrar_movimentacao", {
    p_destino_local: d.destinoLocalId,
    p_novo_responsavel: d.novoResponsavelId,
    p_data_evento: d.dataEvento,
    p_motivo: d.motivo,
    ...(bem ? { p_bem: bem } : {}),
    ...(lote ? { p_lote: lote } : {}),
    ...(d.quantidade ? { p_quantidade: decimalParaJson(d.quantidade) } : {}),
    ...(d.correcao && corrige ? { p_corrige: corrige } : {}),
  });
  if (error || !novo) return falha(traduzirErroBanco(error).mensagem, { valores: entrada });
  revalidarAlvo(bem, lote);
  redirect(`/movimentacoes/${novo}?registrada=1`);
}

export async function aceitarMovimentacao(formData: FormData): Promise<EstadoAcao> {
  await exigirContexto();
  const mov = id(formData.get("id"));
  if (!mov) return falha("Movimentação inválida.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_aceitar_movimentacao", { p_movimentacao: mov });
  if (error) return falha(traduzirErroBanco(error).mensagem);
  revalidatePath("/movimentacoes");
  revalidatePath("/bens");
  redirect(`/movimentacoes/${mov}?aceita=1`);
}

export async function aceiteAdministrativo(formData: FormData): Promise<EstadoAcao> {
  await exigirContexto();
  const mov = id(formData.get("id"));
  const motivo = justificativaSchema.safeParse(formData.get("motivo") ?? "");
  if (!mov) return falha("Movimentação inválida.");
  if (!motivo.success) return falha(motivo.error.issues[0]?.message ?? "Informe a justificativa.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_aceitar_movimentacao", {
    p_movimentacao: mov,
    p_justificativa: motivo.data,
  });
  if (error) return falha(traduzirErroBanco(error).mensagem);
  revalidatePath("/movimentacoes");
  revalidatePath("/bens");
  redirect(`/movimentacoes/${mov}?aceita=1`);
}

export async function recusarMovimentacao(formData: FormData): Promise<EstadoAcao> {
  await exigirContexto();
  const mov = id(formData.get("id"));
  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!mov) return falha("Movimentação inválida.");
  if (motivo.length < 3) return falha("Informe o motivo da recusa.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_recusar_movimentacao", {
    p_movimentacao: mov,
    p_motivo: motivo,
  });
  if (error) return falha(traduzirErroBanco(error).mensagem);
  revalidatePath("/movimentacoes");
  revalidatePath("/bens");
  redirect(`/movimentacoes/${mov}?recusada=1`);
}

export async function cancelarMovimentacao(formData: FormData): Promise<EstadoAcao> {
  await exigirContexto();
  const mov = id(formData.get("id"));
  const motivo = justificativaSchema.safeParse(formData.get("motivo") ?? "");
  if (!mov) return falha("Movimentação inválida.");
  if (!motivo.success) return falha(motivo.error.issues[0]?.message ?? "Informe o motivo.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_cancelar_movimentacao", {
    p_movimentacao: mov,
    p_motivo: motivo.data,
  });
  if (error) return falha(traduzirErroBanco(error).mensagem);
  revalidatePath("/movimentacoes");
  revalidatePath("/bens");
  redirect(`/movimentacoes/${mov}?cancelada=1`);
}
