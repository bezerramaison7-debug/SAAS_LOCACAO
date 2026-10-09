"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { camposTexto, errosDoZod, falha, sucesso, type EstadoAcao } from "@/lib/actions/estado";
import { exigirContexto } from "@/lib/auth/contexto";
import { traduzirErroBanco } from "@/lib/db/erros";
import { uuidSchema } from "@/lib/validation/comum";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { CAMPOS_MODELO, CAMPOS_PERGUNTA, modeloChecklistSchema, perguntaSchema } from "./schemas";

const SEM_PERMISSAO = "Você não tem permissão para gerenciar checklists.";

async function contextoGestor() {
  const contexto = await exigirContexto();
  return contexto.permissoes.includes("checklist.gerenciar") ? contexto : null;
}

/** Cria um modelo (versão 1 em rascunho) ou altera nome/descrição de um rascunho. */
export async function salvarModeloChecklist(
  _anterior: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const contexto = await contextoGestor();
  if (!contexto) return falha(SEM_PERMISSAO);
  const entrada = camposTexto(formData, [...CAMPOS_MODELO, "id"]);
  const dados = modeloChecklistSchema.safeParse(entrada);
  if (!dados.success) {
    return falha("Revise os campos destacados.", {
      errosCampo: errosDoZod(dados.error),
      valores: entrada,
    });
  }
  const supabase = await createSupabaseServerClient();
  const id = uuidSchema.safeParse(entrada.id);
  const { data, error } = id.success
    ? await supabase
        .from("modelos_checklist")
        .update(dados.data)
        .eq("id", id.data)
        .eq("empresa_id", contexto.empresa.id)
        .eq("status", "RASCUNHO")
        .select("id")
    : await supabase
        .from("modelos_checklist")
        .insert({ ...dados.data, empresa_id: contexto.empresa.id })
        .select("id");
  if (error) return falha(traduzirErroBanco(error).mensagem, { valores: entrada });
  const criado = data?.[0];
  if (!criado) return falha("Rascunho não encontrado ou sem permissão.", { valores: entrada });
  revalidatePath("/cadastros/checklists");
  redirect(`/cadastros/checklists/${criado.id}?salvo=1`);
}

/** Inclui ou altera uma pergunta de um modelo em rascunho (o banco bloqueia publicados). */
export async function salvarPergunta(
  _anterior: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const contexto = await contextoGestor();
  if (!contexto) return falha(SEM_PERMISSAO);
  const entrada = camposTexto(formData, [...CAMPOS_PERGUNTA, "id", "modeloId"]);
  const fotoRespostas = formData
    .getAll("fotoRespostas")
    .filter((v): v is string => typeof v === "string");
  const valores = { ...entrada, fotoRespostas: fotoRespostas.join("\n") };
  const modeloId = uuidSchema.safeParse(entrada.modeloId);
  if (!modeloId.success) return falha("Modelo inválido.");
  const dados = perguntaSchema.safeParse({ ...entrada, fotoRespostas });
  if (!dados.success) {
    return falha("Revise os campos destacados.", { errosCampo: errosDoZod(dados.error), valores });
  }
  const d = dados.data;
  const registro = {
    ordem: d.ordem,
    texto: d.texto,
    tipo_resposta: d.tipoResposta,
    opcoes: d.opcoes,
    obrigatoria: d.obrigatoria,
    exige_foto_se: d.exigeFoto,
  };
  const supabase = await createSupabaseServerClient();
  const id = uuidSchema.safeParse(entrada.id);
  const { data, error } = id.success
    ? await supabase
        .from("perguntas_checklist")
        .update(registro)
        .eq("id", id.data)
        .eq("modelo_id", modeloId.data)
        .eq("empresa_id", contexto.empresa.id)
        .select("id")
    : await supabase
        .from("perguntas_checklist")
        .insert({ ...registro, modelo_id: modeloId.data, empresa_id: contexto.empresa.id })
        .select("id");
  if (error) {
    const erro = traduzirErroBanco(error);
    if (erro.codigo === "DUPLICADO") {
      return falha("Já existe pergunta nesta ordem.", {
        errosCampo: { ordem: "Ordem já usada" },
        valores,
      });
    }
    return falha(erro.mensagem, { valores });
  }
  if (!data?.length) return falha("Pergunta não encontrada ou sem permissão.", { valores });
  revalidatePath(`/cadastros/checklists/${modeloId.data}`);
  redirect(`/cadastros/checklists/${modeloId.data}?pergunta_salva=1`);
}

export async function excluirPergunta(formData: FormData): Promise<EstadoAcao> {
  const contexto = await contextoGestor();
  if (!contexto) return falha(SEM_PERMISSAO);
  const id = uuidSchema.safeParse(formData.get("id"));
  const modeloId = uuidSchema.safeParse(formData.get("modeloId"));
  if (!id.success || !modeloId.success) return falha("Pergunta inválida.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("perguntas_checklist")
    .delete()
    .eq("id", id.data)
    .eq("modelo_id", modeloId.data)
    .eq("empresa_id", contexto.empresa.id)
    .select("id");
  if (error) return falha(traduzirErroBanco(error).mensagem);
  if (!data?.length) return falha("Pergunta não encontrada ou sem permissão.");
  revalidatePath(`/cadastros/checklists/${modeloId.data}`);
  return sucesso("Pergunta excluída.");
}

/** Publica o rascunho (torna-se a versão vigente; a anterior é arquivada). */
export async function publicarChecklist(formData: FormData): Promise<EstadoAcao> {
  const contexto = await contextoGestor();
  if (!contexto) return falha(SEM_PERMISSAO);
  const id = uuidSchema.safeParse(formData.get("id"));
  if (!id.success) return falha("Modelo inválido.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_publicar_checklist", { p_modelo: id.data });
  if (error) return falha(traduzirErroBanco(error).mensagem);
  revalidatePath("/cadastros/checklists");
  redirect(`/cadastros/checklists/${id.data}?publicado=1`);
}

/** Cria nova versão (rascunho) a partir de um modelo publicado ou arquivado. */
export async function novaVersaoChecklist(formData: FormData): Promise<EstadoAcao> {
  const contexto = await contextoGestor();
  if (!contexto) return falha(SEM_PERMISSAO);
  const id = uuidSchema.safeParse(formData.get("id"));
  if (!id.success) return falha("Modelo inválido.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("rpc_nova_versao_checklist", { p_modelo: id.data });
  if (error || !data) return falha(traduzirErroBanco(error).mensagem);
  revalidatePath("/cadastros/checklists");
  redirect(`/cadastros/checklists/${data}?nova_versao=1`);
}
