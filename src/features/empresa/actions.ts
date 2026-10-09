"use server";

import { revalidatePath } from "next/cache";

import { camposTexto, errosDoZod, falha, sucesso, type EstadoAcao } from "@/lib/actions/estado";
import { exigirContexto } from "@/lib/auth/contexto";
import { traduzirErroBanco } from "@/lib/db/erros";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { empresaSchema, perfilSchema } from "./schemas";

export async function atualizarPerfil(
  _anterior: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const contexto = await exigirContexto();
  const entrada = camposTexto(formData, ["nome", "telefone"]);
  const dados = perfilSchema.safeParse(entrada);
  if (!dados.success) {
    return falha("Revise os campos destacados.", {
      errosCampo: errosDoZod(dados.error),
      valores: entrada,
    });
  }
  const supabase = await createSupabaseServerClient();
  // RLS: só o próprio usuário altera o próprio perfil (nome, telefone).
  const { error } = await supabase
    .from("perfis_usuario")
    .update({ nome: dados.data.nome, telefone: dados.data.telefone })
    .eq("user_id", contexto.usuario.id);
  if (error) return falha(traduzirErroBanco(error).mensagem, { valores: entrada });
  revalidatePath("/", "layout");
  return sucesso("Perfil atualizado.");
}

export async function atualizarEmpresa(
  _anterior: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const contexto = await exigirContexto();
  if (!contexto.permissoes.includes("empresa.configurar")) {
    return falha("Você não tem permissão para configurar a empresa.");
  }
  const entrada = camposTexto(formData, ["nome", "timezone", "exigeAceite", "limiteAtrasoHoras"]);
  const dados = empresaSchema.safeParse(entrada);
  if (!dados.success) {
    return falha("Revise os campos destacados.", {
      errosCampo: errosDoZod(dados.error),
      valores: entrada,
    });
  }
  const supabase = await createSupabaseServerClient();
  // A empresa vem do contexto do servidor — nunca do formulário.
  const { data, error } = await supabase
    .from("empresas")
    .update({
      nome: dados.data.nome,
      timezone: dados.data.timezone,
      exige_aceite_movimentacao: dados.data.exigeAceite,
      limite_atraso_horas: dados.data.limiteAtrasoHoras,
    })
    .eq("id", contexto.empresa.id)
    .select("id");
  if (error) return falha(traduzirErroBanco(error).mensagem, { valores: entrada });
  if (!data?.length) return falha("Você não tem permissão para configurar a empresa.");
  revalidatePath("/", "layout");
  return sucesso("Configurações da empresa salvas.");
}
