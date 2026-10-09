"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { camposTexto, errosDoZod, falha, type EstadoAcao } from "@/lib/actions/estado";
import { exigirContexto } from "@/lib/auth/contexto";
import { traduzirErroBanco } from "@/lib/db/erros";
import { uuidSchema } from "@/lib/validation/comum";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { CAMPOS_CENTRO_CUSTO, edicaoCentroCustoSchema, novoCentroCustoSchema } from "./schemas";

/** Cria ou atualiza (id no formulário). Empresa sempre do contexto; banco revalida (RLS). */
export async function salvarCentroCusto(
  _anterior: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const contexto = await exigirContexto();
  if (!contexto.permissoes.includes("centro_custo.gerenciar")) {
    return falha("Você não tem permissão para gerenciar centros de custo.");
  }
  const entrada = camposTexto(formData, [...CAMPOS_CENTRO_CUSTO, "id"]);
  const id = uuidSchema.safeParse(entrada.id);
  const supabase = await createSupabaseServerClient();
  let resultado;
  if (id.success) {
    const dados = edicaoCentroCustoSchema.safeParse(entrada);
    if (!dados.success) {
      return falha("Revise os campos destacados.", {
        errosCampo: errosDoZod(dados.error),
        valores: entrada,
      });
    }
    resultado = await supabase
      .from("centros_custo")
      .update(dados.data)
      .eq("id", id.data)
      .eq("empresa_id", contexto.empresa.id)
      .select("id");
  } else {
    const dados = novoCentroCustoSchema.safeParse(entrada);
    if (!dados.success) {
      return falha("Revise os campos destacados.", {
        errosCampo: errosDoZod(dados.error),
        valores: entrada,
      });
    }
    resultado = await supabase
      .from("centros_custo")
      .insert({ ...dados.data, empresa_id: contexto.empresa.id })
      .select("id");
  }
  const { data, error } = resultado;
  if (error) {
    const erro = traduzirErroBanco(error);
    const mensagem =
      erro.codigo === "DUPLICADO" ? "Já existe centro de custo com este código." : erro.mensagem;
    return falha(mensagem, { valores: entrada });
  }
  if (!data?.length)
    return falha("Registro não encontrado ou sem permissão.", { valores: entrada });
  revalidatePath("/cadastros/centros-custo");
  redirect("/cadastros/centros-custo?salvo=1");
}
