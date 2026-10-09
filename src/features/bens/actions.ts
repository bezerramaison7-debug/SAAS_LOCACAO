"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { dataFatoSchema } from "@/features/movimentacoes/schemas";
import { camposTexto, errosDoZod, falha, type EstadoAcao } from "@/lib/actions/estado";
import { exigirContexto } from "@/lib/auth/contexto";
import { traduzirErroBanco } from "@/lib/db/erros";
import { uuidSchema } from "@/lib/validation/comum";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const id = (v: FormDataEntryValue | null) => {
  const r = uuidSchema.safeParse(v);
  return r.success ? r.data : null;
};

const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .transform((v) => (v === "" ? null : v));

/** RN-42: troca pelo fornecedor — o antigo é encerrado e um novo bem entra no lugar. */
export async function trocarBem(_anterior: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const contexto = await exigirContexto();
  if (!contexto.permissoes.includes("troca.registrar"))
    return falha("Você não tem permissão para registrar troca.");
  const bem = id(formData.get("bemId"));
  if (!bem) return falha("Bem inválido.");
  const entrada = camposTexto(formData, [
    "motivo",
    "dataEvento",
    "numeroSerie",
    "placa",
    "identificacaoFornecedor",
  ]);
  const dados = z
    .object({
      motivo: z.string().trim().min(10, "Descreva o motivo com pelo menos 10 caracteres").max(4000),
      dataEvento: dataFatoSchema(contexto.empresa.timezone),
      numeroSerie: opcional(80),
      placa: opcional(20),
      identificacaoFornecedor: opcional(80),
    })
    .safeParse(entrada);
  if (!dados.success)
    return falha("Revise os campos destacados.", {
      errosCampo: errosDoZod(dados.error),
      valores: entrada,
    });
  const d = dados.data;
  const supabase = await createSupabaseServerClient();
  const { data: novo, error } = await supabase.rpc("rpc_trocar_bem", {
    p_bem: bem,
    p_motivo: d.motivo,
    p_data_evento: d.dataEvento,
    ...(d.numeroSerie ? { p_numero_serie: d.numeroSerie } : {}),
    ...(d.placa ? { p_placa: d.placa } : {}),
    ...(d.identificacaoFornecedor ? { p_identificacao_fornecedor: d.identificacaoFornecedor } : {}),
  });
  if (error || !novo) return falha(traduzirErroBanco(error).mensagem, { valores: entrada });
  revalidatePath("/bens");
  revalidatePath(`/bens/${bem}`);
  redirect(`/bens/${novo}?substituto=1`);
}

export async function iniciarVistoriaPeriodica(formData: FormData): Promise<EstadoAcao> {
  const contexto = await exigirContexto();
  if (!contexto.permissoes.includes("vistoria.registrar"))
    return falha("Você não tem permissão para registrar vistorias.");
  const bem = id(formData.get("bemId"));
  const lote = id(formData.get("loteId"));
  const supabase = await createSupabaseServerClient();
  const { data: vistoria, error } = await supabase.rpc("rpc_iniciar_vistoria", {
    p_tipo: "PERIODICA",
    ...(bem ? { p_bem: bem } : {}),
    ...(lote ? { p_lote: lote } : {}),
  });
  if (error || !vistoria) return falha(traduzirErroBanco(error).mensagem);
  redirect(`/vistorias/${vistoria}`);
}

export async function concluirVistoria(formData: FormData): Promise<EstadoAcao> {
  const contexto = await exigirContexto();
  if (!contexto.permissoes.includes("vistoria.registrar"))
    return falha("Você não tem permissão para registrar vistorias.");
  const vistoria = id(formData.get("id"));
  if (!vistoria) return falha("Vistoria inválida.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_concluir_vistoria", { p_vistoria: vistoria });
  if (error) return falha(traduzirErroBanco(error).mensagem);
  revalidatePath(`/vistorias/${vistoria}`);
  revalidatePath("/bens");
  redirect(`/vistorias/${vistoria}?concluida=1`);
}
