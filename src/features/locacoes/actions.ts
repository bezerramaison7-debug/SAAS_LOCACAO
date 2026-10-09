"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { camposTexto, errosDoZod, falha, sucesso, type EstadoAcao } from "@/lib/actions/estado";
import { type Contexto, exigirContexto } from "@/lib/auth/contexto";
import { traduzirErroBanco } from "@/lib/db/erros";
import { decimalParaJson } from "@/lib/format/decimal-json";
import { insercaoComGerados } from "@/lib/db/gerados";
import { type Permissao } from "@/lib/permissions/matriz";
import { justificativaSchema, uuidSchema } from "@/lib/validation/comum";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  CAMPOS_IDENTIFICACAO,
  CAMPOS_ITEM,
  CAMPOS_REFERENCIA,
  CAMPOS_VIGENCIA,
  identificacaoSchema,
  itemSchema,
  referenciaSchema,
  vigenciaSchema,
} from "./schemas";

/**
 * Regras: a empresa vem SEMPRE do contexto da sessão; a permissão é checada
 * aqui (mensagem amigável) e de novo no banco (RLS/funções de domínio). Toda
 * escrita usa `.select("id")` para detectar 0 linhas afetadas (RLS negou ou
 * a locação saiu do rascunho).
 */

const REVISE = "Revise os campos destacados.";

async function contextoCom(permissao: Permissao): Promise<Contexto | null> {
  const contexto = await exigirContexto();
  return contexto.permissoes.includes(permissao) ? contexto : null;
}

function semPermissao(): EstadoAcao {
  return falha("Você não tem permissão para esta ação.");
}

function revalidarLocacao(id: string) {
  revalidatePath("/locacoes");
  revalidatePath(`/locacoes/${id}`);
}

const editar = (id: string, etapa: string) => `/locacoes/${id}/editar?etapa=${etapa}` as const;

// ------------------------------------------------------------ identificação --
export async function salvarIdentificacao(
  _anterior: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const entrada = camposTexto(formData, [...CAMPOS_IDENTIFICACAO, "id"]);
  const id = uuidSchema.safeParse(entrada.id);
  const contexto = await contextoCom(id.success ? "locacao.editar" : "locacao.criar");
  if (!contexto) return semPermissao();
  const dados = identificacaoSchema.safeParse(entrada);
  if (!dados.success)
    return falha(REVISE, { errosCampo: errosDoZod(dados.error), valores: entrada });
  const registro = {
    fornecedor_id: dados.data.fornecedorId,
    centro_custo_id: dados.data.centroCustoId,
    observacoes: dados.data.observacoes,
  };
  const supabase = await createSupabaseServerClient();
  const { data, error } = id.success
    ? await supabase
        .from("locacoes")
        .update(registro)
        .eq("id", id.data)
        .eq("empresa_id", contexto.empresa.id)
        .eq("status", "RASCUNHO")
        .select("id")
    : await supabase
        .from("locacoes")
        .insert(insercaoComGerados("locacoes", { ...registro, empresa_id: contexto.empresa.id }))
        .select("id");
  if (error) return falha(traduzirErroBanco(error).mensagem, { valores: entrada });
  const salvo = data?.[0];
  if (!salvo)
    return falha("Locação não encontrada, fora do rascunho ou sem permissão.", {
      valores: entrada,
    });
  revalidarLocacao(salvo.id);
  redirect(editar(salvo.id, "referencias"));
}

// --------------------------------------------------------------- referências --
const RETORNOS = { editar: "editar", detalhe: "detalhe" } as const;

function destinoReferencia(locacaoId: string, retorno: string) {
  return retorno === RETORNOS.detalhe
    ? (`/locacoes/${locacaoId}?aba=resumo` as const)
    : editar(locacaoId, "referencias");
}

export async function adicionarReferencia(
  _anterior: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const contexto = await contextoCom("locacao.referencia.gerenciar");
  if (!contexto) return semPermissao();
  const entrada = camposTexto(formData, [...CAMPOS_REFERENCIA, "locacaoId", "retorno"]);
  const locacaoId = uuidSchema.safeParse(entrada.locacaoId);
  if (!locacaoId.success) return falha("Locação inválida.");
  const dados = referenciaSchema.safeParse(entrada);
  if (!dados.success)
    return falha(REVISE, { errosCampo: errosDoZod(dados.error), valores: entrada });
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("referencias_externas")
    .insert({
      empresa_id: contexto.empresa.id,
      locacao_id: locacaoId.data,
      sistema: dados.data.sistema,
      tipo: dados.data.tipo,
      numero: dados.data.numero,
      data_documento: dados.data.dataDocumento,
      observacao: dados.data.observacao,
    })
    .select("id");
  if (error) {
    const erro = traduzirErroBanco(error);
    if (erro.codigo === "DUPLICADO") {
      return falha("Este documento já está vinculado a uma locação desta empresa.", {
        errosCampo: { numero: "Documento já vinculado" },
        valores: entrada,
      });
    }
    return falha(erro.mensagem, { valores: entrada });
  }
  if (!data?.length) return falha("Não foi possível vincular a referência.", { valores: entrada });
  revalidarLocacao(locacaoId.data);
  redirect(destinoReferencia(locacaoId.data, entrada.retorno ?? ""));
}

/** Exclusão só no rascunho (RLS); depois da ativação a referência é histórica. */
export async function excluirReferencia(formData: FormData): Promise<EstadoAcao> {
  const contexto = await contextoCom("locacao.referencia.gerenciar");
  if (!contexto) return semPermissao();
  const id = uuidSchema.safeParse(formData.get("id"));
  const locacaoId = uuidSchema.safeParse(formData.get("locacaoId"));
  if (!id.success || !locacaoId.success) return falha("Referência inválida.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("referencias_externas")
    .delete()
    .eq("id", id.data)
    .eq("locacao_id", locacaoId.data)
    .eq("empresa_id", contexto.empresa.id)
    .select("id");
  if (error) return falha(traduzirErroBanco(error).mensagem);
  if (!data?.length) return falha("Referência não encontrada ou locação fora do rascunho.");
  revalidarLocacao(locacaoId.data);
  return sucesso("Referência removida.");
}

// --------------------------------------------------------------------- itens --
export async function salvarItem(_anterior: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const contexto = await contextoCom("locacao.editar");
  if (!contexto) return semPermissao();
  const entrada = camposTexto(formData, [...CAMPOS_ITEM, "id", "locacaoId"]);
  const locacaoId = uuidSchema.safeParse(entrada.locacaoId);
  if (!locacaoId.success) return falha("Locação inválida.");
  const categoriaId = uuidSchema.safeParse(entrada.categoriaId);
  if (!categoriaId.success) {
    return falha(REVISE, {
      errosCampo: { categoriaId: "Selecione a categoria" },
      valores: entrada,
    });
  }
  const supabase = await createSupabaseServerClient();
  // O modo de controle vem da categoria cadastrada, nunca do formulário (RN-11).
  const { data: categoria } = await supabase
    .from("categorias_bem")
    .select("modo_controle, ativo")
    .eq("id", categoriaId.data)
    .eq("empresa_id", contexto.empresa.id)
    .maybeSingle();
  if (!categoria?.ativo) {
    return falha(REVISE, {
      errosCampo: { categoriaId: "Categoria inexistente ou inativa" },
      valores: entrada,
    });
  }
  const dados = itemSchema(categoria.modo_controle).safeParse(entrada);
  if (!dados.success)
    return falha(REVISE, { errosCampo: errosDoZod(dados.error), valores: entrada });
  const d = dados.data;
  const registro = {
    categoria_id: d.categoriaId,
    descricao: d.descricao,
    // JSON exato: decimalParaJson rejeita qualquer valor que perderia precisão.
    quantidade_contratada: decimalParaJson(d.quantidade),
    unidade: d.unidade,
    valor_unitario: decimalParaJson(d.valorUnitario),
    periodicidade: d.periodicidade,
    observacao: d.observacao,
  };
  const id = uuidSchema.safeParse(entrada.id);
  const { data, error } = id.success
    ? await supabase
        .from("itens_locacao")
        .update(registro)
        .eq("id", id.data)
        .eq("locacao_id", locacaoId.data)
        .eq("empresa_id", contexto.empresa.id)
        .select("id")
    : await supabase
        .from("itens_locacao")
        .insert(
          insercaoComGerados("itens_locacao", {
            ...registro,
            empresa_id: contexto.empresa.id,
            locacao_id: locacaoId.data,
          }),
        )
        .select("id");
  if (error) return falha(traduzirErroBanco(error).mensagem, { valores: entrada });
  if (!data?.length)
    return falha("Item não salvo: locação fora do rascunho ou sem permissão.", {
      valores: entrada,
    });
  revalidarLocacao(locacaoId.data);
  redirect(`${editar(locacaoId.data, "itens")}&item_salvo=1`);
}

export async function excluirItem(formData: FormData): Promise<EstadoAcao> {
  const contexto = await contextoCom("locacao.editar");
  if (!contexto) return semPermissao();
  const id = uuidSchema.safeParse(formData.get("id"));
  const locacaoId = uuidSchema.safeParse(formData.get("locacaoId"));
  if (!id.success || !locacaoId.success) return falha("Item inválido.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("itens_locacao")
    .delete()
    .eq("id", id.data)
    .eq("locacao_id", locacaoId.data)
    .eq("empresa_id", contexto.empresa.id)
    .select("id");
  if (error) return falha(traduzirErroBanco(error).mensagem);
  if (!data?.length) return falha("Item não encontrado ou locação fora do rascunho.");
  revalidarLocacao(locacaoId.data);
  return sucesso("Item removido.");
}

// ------------------------------------------------------------------ vigência --
export async function salvarVigencia(
  _anterior: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const contexto = await contextoCom("locacao.editar");
  if (!contexto) return semPermissao();
  const entrada = camposTexto(formData, [...CAMPOS_VIGENCIA, "id"]);
  const id = uuidSchema.safeParse(entrada.id);
  if (!id.success) return falha("Locação inválida.");
  const dados = vigenciaSchema.safeParse(entrada);
  if (!dados.success)
    return falha(REVISE, { errosCampo: errosDoZod(dados.error), valores: entrada });
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("locacoes")
    .update({
      inicio_previsto: dados.data.inicioPrevisto,
      termino_previsto: dados.data.terminoPrevisto,
    })
    .eq("id", id.data)
    .eq("empresa_id", contexto.empresa.id)
    .eq("status", "RASCUNHO")
    .select("id");
  if (error) return falha(traduzirErroBanco(error).mensagem, { valores: entrada });
  if (!data?.length)
    return falha("Locação fora do rascunho ou sem permissão.", { valores: entrada });
  revalidarLocacao(id.data);
  redirect(editar(id.data, "revisao"));
}

// --------------------------------------------------- ativação / cancelamento --
export async function ativarLocacao(formData: FormData): Promise<EstadoAcao> {
  const contexto = await contextoCom("locacao.ativar");
  if (!contexto) return semPermissao();
  const id = uuidSchema.safeParse(formData.get("id"));
  if (!id.success) return falha("Locação inválida.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_ativar_locacao", { p_locacao: id.data });
  if (error) return falha(traduzirErroBanco(error).mensagem);
  revalidarLocacao(id.data);
  redirect(`/locacoes/${id.data}?ativada=1`);
}

export async function cancelarLocacao(formData: FormData): Promise<EstadoAcao> {
  const contexto = await contextoCom("locacao.cancelar");
  if (!contexto) return semPermissao();
  const id = uuidSchema.safeParse(formData.get("id"));
  if (!id.success) return falha("Locação inválida.");
  const motivo = justificativaSchema.safeParse(formData.get("motivo") ?? "");
  if (!motivo.success) return falha(motivo.error.issues[0]?.message ?? "Informe o motivo.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_cancelar_locacao", {
    p_locacao: id.data,
    p_motivo: motivo.data,
  });
  if (error) return falha(traduzirErroBanco(error).mensagem);
  revalidarLocacao(id.data);
  redirect(`/locacoes/${id.data}?cancelada=1`);
}
