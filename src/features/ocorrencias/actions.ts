"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { camposTexto, errosDoZod, falha, type EstadoAcao } from "@/lib/actions/estado";
import { exigirContexto } from "@/lib/auth/contexto";
import { traduzirErroBanco } from "@/lib/db/erros";
import { decimalParaJson } from "@/lib/format/decimal-json";
import { justificativaSchema, uuidSchema } from "@/lib/validation/comum";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { CAMPOS_OCORRENCIA, ocorrenciaSchema, resolucaoSchema, tratamentoSchema } from "./schemas";

const id = (v: FormDataEntryValue | null) => {
  const r = uuidSchema.safeParse(v);
  return r.success ? r.data : null;
};

function revalidar(ocorrencia?: string) {
  revalidatePath("/ocorrencias");
  revalidatePath("/bens");
  if (ocorrencia) revalidatePath(`/ocorrencias/${ocorrencia}`);
}

export async function registrarOcorrencia(
  _anterior: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const contexto = await exigirContexto();
  if (!contexto.permissoes.includes("ocorrencia.registrar")) {
    return falha("Você não tem permissão para registrar ocorrências.");
  }
  const bem = id(formData.get("bemId"));
  const lote = id(formData.get("loteId"));
  const locacao = id(formData.get("locacaoId"));
  if (!bem && !lote && !locacao) return falha("Informe o bem, o lote ou a locação.");
  const entrada = camposTexto(formData, CAMPOS_OCORRENCIA);
  const dados = ocorrenciaSchema(contexto.empresa.timezone).safeParse(entrada);
  if (!dados.success)
    return falha("Revise os campos destacados.", {
      errosCampo: errosDoZod(dados.error),
      valores: entrada,
    });
  const d = dados.data;
  const supabase = await createSupabaseServerClient();
  const { data: novo, error } = await supabase.rpc("rpc_registrar_ocorrencia", {
    p_tipo: d.tipo,
    p_descricao: d.descricao,
    p_data_evento: d.dataEvento,
    p_prioridade: d.prioridade,
    p_manutencao: d.manutencao,
    ...(bem ? { p_bem: bem } : {}),
    ...(lote ? { p_lote: lote } : {}),
    ...(!bem && !lote && locacao ? { p_locacao: locacao } : {}),
    ...(d.prazo ? { p_prazo: d.prazo } : {}),
    ...(d.quantidade ? { p_quantidade: decimalParaJson(d.quantidade) } : {}),
  });
  if (error || !novo) return falha(traduzirErroBanco(error).mensagem, { valores: entrada });
  revalidar();
  if (bem) revalidatePath(`/bens/${bem}`);
  if (lote) revalidatePath(`/bens/lotes/${lote}`);
  redirect(`/ocorrencias/${novo}?registrada=1`);
}

export async function tratarOcorrencia(
  _anterior: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const contexto = await exigirContexto();
  if (!contexto.permissoes.includes("ocorrencia.tratar"))
    return falha("Você não tem permissão para tratar ocorrências.");
  const ocorrencia = id(formData.get("id"));
  if (!ocorrencia) return falha("Ocorrência inválida.");
  const entrada = camposTexto(formData, ["responsavelId", "prazo"]);
  const dados = tratamentoSchema(contexto.empresa.timezone).safeParse(entrada);
  if (!dados.success)
    return falha("Revise os campos destacados.", {
      errosCampo: errosDoZod(dados.error),
      valores: entrada,
    });
  const responsavel = id(dados.data.responsavelId);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_tratar_ocorrencia", {
    p_ocorrencia: ocorrencia,
    ...(responsavel ? { p_responsavel: responsavel } : {}),
    ...(dados.data.prazo ? { p_prazo: dados.data.prazo } : {}),
  });
  if (error) return falha(traduzirErroBanco(error).mensagem, { valores: entrada });
  revalidar(ocorrencia);
  redirect(`/ocorrencias/${ocorrencia}?tratamento=1`);
}

export async function resolverOcorrencia(
  _anterior: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const contexto = await exigirContexto();
  if (!contexto.permissoes.includes("ocorrencia.tratar"))
    return falha("Você não tem permissão para tratar ocorrências.");
  const ocorrencia = id(formData.get("id"));
  if (!ocorrencia) return falha("Ocorrência inválida.");
  const entrada = camposTexto(formData, ["resultado", "resolucao"]);
  const dados = resolucaoSchema.safeParse(entrada);
  if (!dados.success)
    return falha("Revise os campos destacados.", {
      errosCampo: errosDoZod(dados.error),
      valores: entrada,
    });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_resolver_ocorrencia", {
    p_ocorrencia: ocorrencia,
    p_resultado: dados.data.resultado,
    p_resolucao: dados.data.resolucao,
  });
  if (error) return falha(traduzirErroBanco(error).mensagem, { valores: entrada });
  revalidar(ocorrencia);
  redirect(`/ocorrencias/${ocorrencia}?resolvida=1`);
}

async function comMotivo(
  formData: FormData,
  rpc: "rpc_reabrir_ocorrencia" | "rpc_cancelar_ocorrencia",
  aviso: string,
): Promise<EstadoAcao> {
  const contexto = await exigirContexto();
  if (!contexto.permissoes.includes("ocorrencia.tratar"))
    return falha("Você não tem permissão para tratar ocorrências.");
  const ocorrencia = id(formData.get("id"));
  const motivo = justificativaSchema.safeParse(formData.get("motivo") ?? "");
  if (!ocorrencia) return falha("Ocorrência inválida.");
  if (!motivo.success) return falha(motivo.error.issues[0]?.message ?? "Informe o motivo.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc(rpc, { p_ocorrencia: ocorrencia, p_motivo: motivo.data });
  if (error) return falha(traduzirErroBanco(error).mensagem);
  revalidar(ocorrencia);
  redirect(`/ocorrencias/${ocorrencia}?${aviso}=1`);
}

export async function reabrirOcorrencia(formData: FormData): Promise<EstadoAcao> {
  return comMotivo(formData, "rpc_reabrir_ocorrencia", "reaberta");
}

export async function cancelarOcorrencia(formData: FormData): Promise<EstadoAcao> {
  return comMotivo(formData, "rpc_cancelar_ocorrencia", "cancelada");
}
