"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { falha, type EstadoAcao } from "@/lib/actions/estado";
import { exigirContexto } from "@/lib/auth/contexto";
import { traduzirErroBanco } from "@/lib/db/erros";
import { hojeNoFuso } from "@/lib/format/datas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/comum";

/**
 * RN-60..62: encerramento operacional e financeiro são ações, permissões e
 * funções distintas. Nenhuma das duas dispara a outra.
 */
function id(valor: FormDataEntryValue | null) {
  const r = uuidSchema.safeParse(valor);
  return r.success ? r.data : null;
}

function revalidar(locacao: string) {
  revalidatePath("/locacoes");
  revalidatePath(`/locacoes/${locacao}`);
  revalidatePath("/cobrancas");
}

export async function iniciarDesmobilizacao(formData: FormData): Promise<EstadoAcao> {
  const contexto = await exigirContexto();
  if (!contexto.permissoes.includes("locacao.iniciar_desmobilizacao"))
    return falha("Você não tem permissão para esta ação.");
  const locacao = id(formData.get("id"));
  if (!locacao) return falha("Locação inválida.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_iniciar_desmobilizacao", { p_locacao: locacao });
  if (error) return falha(traduzirErroBanco(error).mensagem);
  revalidar(locacao);
  redirect(`/locacoes/${locacao}?desmobilizacao=1`);
}

export async function encerrarOperacional(formData: FormData): Promise<EstadoAcao> {
  const contexto = await exigirContexto();
  if (!contexto.permissoes.includes("locacao.encerrar_operacional"))
    return falha("Você não tem permissão para esta ação.");
  const locacao = id(formData.get("id"));
  if (!locacao) return falha("Locação inválida.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_encerrar_operacional", { p_locacao: locacao });
  if (error) return falha(traduzirErroBanco(error).mensagem);
  revalidar(locacao);
  redirect(`/locacoes/${locacao}?encerrada_operacional=1`);
}

export async function encerrarFinanceiro(
  _anterior: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const contexto = await exigirContexto();
  if (!contexto.permissoes.includes("locacao.encerrar_financeiro"))
    return falha("Você não tem permissão para esta ação.");
  const locacao = id(formData.get("id"));
  if (!locacao) return falha("Locação inválida.");
  const valores = { dataEncerramento: String(formData.get("dataEncerramento") ?? "") };
  const hoje = hojeNoFuso(contexto.empresa.timezone);
  const data = z.iso
    .date({ message: "Informe a data do encerramento" })
    .refine((d) => d <= hoje, "A data não pode estar no futuro")
    .safeParse(valores.dataEncerramento);
  if (!data.success)
    return falha("Revise os campos destacados.", {
      errosCampo: { dataEncerramento: data.error.issues[0]?.message ?? "Data inválida" },
      valores,
    });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_encerrar_financeiro", {
    p_locacao: locacao,
    p_data: data.data,
  });
  if (error) return falha(traduzirErroBanco(error).mensagem, { valores });
  revalidar(locacao);
  redirect(`/locacoes/${locacao}?encerrada_financeiro=1`);
}
