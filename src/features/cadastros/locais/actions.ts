"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { camposTexto, errosDoZod, falha, type EstadoAcao } from "@/lib/actions/estado";
import { exigirContexto } from "@/lib/auth/contexto";
import { traduzirErroBanco } from "@/lib/db/erros";
import { uuidSchema } from "@/lib/validation/comum";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { CAMPOS_LOCAL, edicaoLocalSchema, novoLocalSchema } from "./schemas";

/** Cria ou atualiza (id no formulário). Empresa sempre do contexto; banco revalida (RLS). */
export async function salvarLocal(_anterior: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const contexto = await exigirContexto();
  if (!contexto.permissoes.includes("local.gerenciar")) {
    return falha("Você não tem permissão para gerenciar locais.");
  }
  const entrada = camposTexto(formData, [...CAMPOS_LOCAL, "id"]);
  const id = uuidSchema.safeParse(entrada.id);
  const supabase = await createSupabaseServerClient();
  let resultado;
  if (id.success) {
    const dados = edicaoLocalSchema.safeParse(entrada);
    if (!dados.success) {
      return falha("Revise os campos destacados.", {
        errosCampo: errosDoZod(dados.error),
        valores: entrada,
      });
    }
    resultado = await supabase
      .from("locais")
      .update(dados.data)
      .eq("id", id.data)
      .eq("empresa_id", contexto.empresa.id)
      .select("id");
  } else {
    const dados = novoLocalSchema.safeParse(entrada);
    if (!dados.success) {
      return falha("Revise os campos destacados.", {
        errosCampo: errosDoZod(dados.error),
        valores: entrada,
      });
    }
    resultado = await supabase
      .from("locais")
      .insert({ ...dados.data, empresa_id: contexto.empresa.id })
      .select("id");
  }
  const { data, error } = resultado;
  if (error) {
    const erro = traduzirErroBanco(error);
    const mensagem =
      erro.codigo === "DUPLICADO" ? "Já existe local com este código." : erro.mensagem;
    return falha(mensagem, { valores: entrada });
  }
  if (!data?.length)
    return falha("Registro não encontrado ou sem permissão.", { valores: entrada });
  revalidatePath("/cadastros/locais");
  redirect("/cadastros/locais?salvo=1");
}
