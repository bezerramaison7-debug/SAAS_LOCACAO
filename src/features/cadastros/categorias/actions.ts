"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { camposTexto, errosDoZod, falha, type EstadoAcao } from "@/lib/actions/estado";
import { exigirContexto } from "@/lib/auth/contexto";
import { traduzirErroBanco } from "@/lib/db/erros";
import { uuidSchema } from "@/lib/validation/comum";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { CAMPOS_CATEGORIA, categoriaSchema } from "./schemas";

/** Cria ou atualiza (id no formulário). Empresa sempre do contexto; banco revalida (RLS). */
export async function salvarCategoria(
  _anterior: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const contexto = await exigirContexto();
  if (!contexto.permissoes.includes("categoria.gerenciar")) {
    return falha("Você não tem permissão para gerenciar categorias.");
  }
  const entrada = camposTexto(formData, [...CAMPOS_CATEGORIA, "id"]);
  const id = uuidSchema.safeParse(entrada.id);
  const supabase = await createSupabaseServerClient();

  let modoExistente: "INDIVIDUAL" | "LOTE" | undefined;
  if (id.success) {
    const { data: atual } = await supabase
      .from("categorias_bem")
      .select("modo_controle")
      .eq("id", id.data)
      .eq("empresa_id", contexto.empresa.id)
      .maybeSingle();
    if (!atual) return falha("Registro não encontrado ou sem permissão.", { valores: entrada });
    modoExistente = atual.modo_controle;
  }
  const dados = categoriaSchema(modoExistente).safeParse(entrada);
  if (!dados.success) {
    return falha("Revise os campos destacados.", {
      errosCampo: errosDoZod(dados.error),
      valores: entrada,
    });
  }
  const d = dados.data;
  const registro = {
    nome: d.nome,
    checklist_familia_id: d.checklistFamiliaId,
    exige_numero_serie: d.exigeNumeroSerie,
    exige_placa: d.exigePlaca,
    exige_ident_fornecedor: d.exigeIdentFornecedor,
    exige_vistoria_saida: d.exigeVistoriaSaida,
    unidade_padrao: d.unidadePadrao,
    ativo: d.ativo,
  };
  const { data, error } = id.success
    ? await supabase
        .from("categorias_bem")
        .update(registro)
        .eq("id", id.data)
        .eq("empresa_id", contexto.empresa.id)
        .select("id")
    : await supabase
        .from("categorias_bem")
        .insert({ ...registro, modo_controle: d.modoControle, empresa_id: contexto.empresa.id })
        .select("id");
  if (error) {
    const erro = traduzirErroBanco(error);
    const mensagem =
      erro.codigo === "DUPLICADO" ? "Já existe categoria com este nome." : erro.mensagem;
    return falha(mensagem, { valores: entrada });
  }
  if (!data?.length)
    return falha("Registro não encontrado ou sem permissão.", { valores: entrada });
  revalidatePath("/cadastros/categorias");
  redirect("/cadastros/categorias?salvo=1");
}
