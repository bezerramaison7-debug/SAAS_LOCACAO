"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { camposTexto, errosDoZod, falha, type EstadoAcao } from "@/lib/actions/estado";
import { exigirContexto } from "@/lib/auth/contexto";
import { traduzirErroBanco } from "@/lib/db/erros";
import { uuidSchema } from "@/lib/validation/comum";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { CAMPOS_FORNECEDOR, fornecedorSchema, type DadosFornecedor } from "./schemas";

function paraBanco(d: DadosFornecedor) {
  const contato: Record<string, string> = {};
  if (d.contatoNome) contato.nome = d.contatoNome;
  if (d.contatoEmail) contato.email = d.contatoEmail;
  if (d.contatoTelefone) contato.telefone = d.contatoTelefone;
  return {
    razao_social: d.razaoSocial,
    nome_fantasia: d.nomeFantasia,
    documento: d.documento,
    contato,
    observacoes: d.observacoes,
    ativo: d.ativo,
  };
}

/** Cria ou atualiza (id no formulário). Empresa sempre do contexto; banco revalida (RLS). */
export async function salvarFornecedor(
  _anterior: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const contexto = await exigirContexto();
  if (!contexto.permissoes.includes("fornecedor.gerenciar")) {
    return falha("Você não tem permissão para gerenciar fornecedores.");
  }
  const entrada = camposTexto(formData, [...CAMPOS_FORNECEDOR, "id"]);
  const dados = fornecedorSchema.safeParse(entrada);
  if (!dados.success) {
    return falha("Revise os campos destacados.", {
      errosCampo: errosDoZod(dados.error),
      valores: entrada,
    });
  }
  const supabase = await createSupabaseServerClient();
  const registro = paraBanco(dados.data);
  const id = uuidSchema.safeParse(entrada.id);
  const { data, error } = id.success
    ? await supabase
        .from("fornecedores")
        .update(registro)
        .eq("id", id.data)
        .eq("empresa_id", contexto.empresa.id)
        .select("id")
    : await supabase
        .from("fornecedores")
        .insert({ ...registro, empresa_id: contexto.empresa.id })
        .select("id");
  if (!error && !data?.length)
    return falha("Registro não encontrado ou sem permissão.", { valores: entrada });
  if (error) {
    const erro = traduzirErroBanco(error);
    const mensagem =
      erro.codigo === "DUPLICADO" ? "Já existe fornecedor com este documento." : erro.mensagem;
    return falha(mensagem, { valores: entrada });
  }
  revalidatePath("/cadastros/fornecedores");
  redirect("/cadastros/fornecedores?salvo=1");
}
