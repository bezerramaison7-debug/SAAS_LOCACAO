"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { camposTexto, errosDoZod, falha, sucesso, type EstadoAcao } from "@/lib/actions/estado";
import { type Contexto, exigirContexto } from "@/lib/auth/contexto";
import { traduzirErroBanco } from "@/lib/db/erros";
import { insercaoComGerados } from "@/lib/db/gerados";
import { decimalParaJson } from "@/lib/format/decimal-json";
import { type Permissao } from "@/lib/permissions/matriz";
import { justificativaSchema, uuidSchema } from "@/lib/validation/comum";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  bemSchema,
  CAMPOS_BEM,
  CAMPOS_DESTINO,
  CAMPOS_LOTE,
  destinoSchema,
  lerRespostas,
  loteSchema,
} from "./schemas";

/**
 * Empresa sempre do contexto; permissão checada aqui (mensagem amigável) e de
 * novo no banco (RLS + funções de domínio, que também exigem o rascunho).
 */

const REVISE = "Revise os campos destacados.";

async function contextoCom(permissao: Permissao): Promise<Contexto | null> {
  const contexto = await exigirContexto();
  return contexto.permissoes.includes(permissao) ? contexto : null;
}

const semPermissao = () => falha("Você não tem permissão para esta ação.");
const etapa = (id: string, nome: string, extra = "") =>
  `/recebimentos/${id}?etapa=${nome}${extra}` as const;

function revalidar(id: string) {
  revalidatePath("/recebimentos");
  revalidatePath(`/recebimentos/${id}`);
}

function id(valor: FormDataEntryValue | null) {
  const r = uuidSchema.safeParse(valor);
  return r.success ? r.data : null;
}

// --------------------------------------------------------------- criação ----
export async function criarRecebimento(
  _anterior: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const contexto = await contextoCom("recebimento.registrar");
  if (!contexto) return semPermissao();
  const locacaoId = id(formData.get("locacaoId"));
  if (!locacaoId) return falha(REVISE, { errosCampo: { locacaoId: "Selecione a locação" } });
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("recebimentos")
    .insert(
      insercaoComGerados("recebimentos", {
        empresa_id: contexto.empresa.id,
        locacao_id: locacaoId,
      }),
    )
    .select("id");
  if (error) {
    const erro = traduzirErroBanco(error);
    return falha(
      erro.codigo === "SEM_PERMISSAO"
        ? "A locação precisa estar ativa para receber itens."
        : erro.mensagem,
    );
  }
  const novo = data?.[0];
  if (!novo) return falha("A locação precisa estar ativa para receber itens.");
  revalidatePath("/recebimentos");
  redirect(etapa(novo.id, "itens"));
}

// ----------------------------------------------------------------- itens ----
export async function adicionarBem(_anterior: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const contexto = await contextoCom("recebimento.registrar");
  if (!contexto) return semPermissao();
  const recebimentoId = id(formData.get("recebimentoId"));
  const itemId = id(formData.get("itemLocacaoId"));
  if (!recebimentoId || !itemId) return falha("Item inválido.");
  const entrada = camposTexto(formData, CAMPOS_BEM);
  const dados = bemSchema({
    numeroSerie: formData.get("exigeNumeroSerie") === "1",
    placa: formData.get("exigePlaca") === "1",
    identificacaoFornecedor: formData.get("exigeIdentFornecedor") === "1",
  }).safeParse(entrada);
  if (!dados.success)
    return falha(REVISE, { errosCampo: errosDoZod(dados.error), valores: entrada });
  const d = dados.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_adicionar_bem_recebimento", {
    p_recebimento: recebimentoId,
    p_item_locacao: itemId,
    p_condicao: d.condicao,
    ...(d.numeroSerie ? { p_numero_serie: d.numeroSerie } : {}),
    ...(d.placa ? { p_placa: d.placa } : {}),
    ...(d.identificacaoFornecedor ? { p_identificacao_fornecedor: d.identificacaoFornecedor } : {}),
    ...(d.observacao ? { p_observacao: d.observacao } : {}),
  });
  if (error) return falha(traduzirErroBanco(error).mensagem, { valores: entrada });
  revalidar(recebimentoId);
  return sucesso("Unidade incluída.");
}

export async function definirLote(_anterior: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const contexto = await contextoCom("recebimento.registrar");
  if (!contexto) return semPermissao();
  const recebimentoId = id(formData.get("recebimentoId"));
  const itemId = id(formData.get("itemLocacaoId"));
  if (!recebimentoId || !itemId) return falha("Item inválido.");
  const entrada = camposTexto(formData, CAMPOS_LOTE);
  const dados = loteSchema.safeParse(entrada);
  if (!dados.success)
    return falha(REVISE, { errosCampo: errosDoZod(dados.error), valores: entrada });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_definir_lote_recebimento", {
    p_recebimento: recebimentoId,
    p_item_locacao: itemId,
    p_quantidade: decimalParaJson(dados.data.quantidade),
    p_condicao: dados.data.condicao,
    ...(dados.data.observacao ? { p_observacao: dados.data.observacao } : {}),
  });
  if (error) return falha(traduzirErroBanco(error).mensagem, { valores: entrada });
  revalidar(recebimentoId);
  return sucesso("Quantidade registrada.");
}

export async function removerLinha(formData: FormData): Promise<EstadoAcao> {
  const contexto = await contextoCom("recebimento.registrar");
  if (!contexto) return semPermissao();
  const linha = id(formData.get("id"));
  const recebimentoId = id(formData.get("recebimentoId"));
  if (!linha || !recebimentoId) return falha("Item inválido.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_remover_linha_recebimento", { p_linha: linha });
  if (error) return falha(traduzirErroBanco(error).mensagem);
  revalidar(recebimentoId);
  return sucesso("Item removido.");
}

/** Corrige identificação/condição de uma unidade ainda no rascunho (RLS exige rascunho). */
export async function atualizarBem(_anterior: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const contexto = await contextoCom("recebimento.registrar");
  if (!contexto) return semPermissao();
  const linha = id(formData.get("linhaId"));
  const bem = id(formData.get("bemId"));
  const recebimentoId = id(formData.get("recebimentoId"));
  if (!linha || !bem || !recebimentoId) return falha("Item inválido.");
  const entrada = camposTexto(formData, CAMPOS_BEM);
  const dados = bemSchema({
    numeroSerie: formData.get("exigeNumeroSerie") === "1",
    placa: formData.get("exigePlaca") === "1",
    identificacaoFornecedor: formData.get("exigeIdentFornecedor") === "1",
  }).safeParse(entrada);
  if (!dados.success)
    return falha(REVISE, { errosCampo: errosDoZod(dados.error), valores: entrada });
  const d = dados.data;
  const supabase = await createSupabaseServerClient();
  const [bens, linhas] = await Promise.all([
    supabase
      .from("bens")
      .update({
        numero_serie: d.numeroSerie,
        placa: d.placa,
        identificacao_fornecedor: d.identificacaoFornecedor,
      })
      .eq("id", bem)
      .eq("empresa_id", contexto.empresa.id)
      .select("id"),
    supabase
      .from("itens_recebimento")
      .update({ condicao: d.condicao, observacao: d.observacao })
      .eq("id", linha)
      .eq("empresa_id", contexto.empresa.id)
      .select("id"),
  ]);
  const erro = bens.error ?? linhas.error;
  if (erro) return falha(traduzirErroBanco(erro).mensagem, { valores: entrada });
  if (!bens.data?.length || !linhas.data?.length)
    return falha("Recebimento fora do rascunho.", { valores: entrada });
  revalidar(recebimentoId);
  return sucesso("Unidade atualizada.");
}

// -------------------------------------------------------------- destino -----
export async function salvarDestino(
  _anterior: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const contexto = await contextoCom("recebimento.registrar");
  if (!contexto) return semPermissao();
  const recebimentoId = id(formData.get("recebimentoId"));
  if (!recebimentoId) return falha("Recebimento inválido.");
  const entrada = camposTexto(formData, CAMPOS_DESTINO);
  const dados = destinoSchema(contexto.empresa.timezone).safeParse(entrada);
  if (!dados.success)
    return falha(REVISE, { errosCampo: errosDoZod(dados.error), valores: entrada });
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("recebimentos")
    .update({
      data_evento: dados.data.dataEvento,
      local_id: dados.data.localId,
      responsavel_id: dados.data.responsavelId,
      observacoes: dados.data.observacoes,
    })
    .eq("id", recebimentoId)
    .eq("empresa_id", contexto.empresa.id)
    .select("id");
  if (error) return falha(traduzirErroBanco(error).mensagem, { valores: entrada });
  if (!data?.length)
    return falha("Recebimento fora do rascunho ou sem permissão.", { valores: entrada });
  revalidar(recebimentoId);
  redirect(etapa(recebimentoId, "revisao"));
}

// -------------------------------------------------------------- vistoria ----
export async function iniciarVistoria(formData: FormData): Promise<EstadoAcao> {
  const contexto = await contextoCom("vistoria.registrar");
  if (!contexto) return semPermissao();
  const linha = id(formData.get("linhaId"));
  const recebimentoId = id(formData.get("recebimentoId"));
  if (!linha || !recebimentoId) return falha("Item inválido.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_iniciar_vistoria_entrada", { p_linha: linha });
  if (error) return falha(traduzirErroBanco(error).mensagem);
  revalidar(recebimentoId);
  redirect(etapa(recebimentoId, "checklist", `&linha=${linha}`));
}

/** Grava as respostas (upsert por pergunta; vazio remove). A validação de tipo também ocorre no banco. */
export async function salvarRespostas(
  _anterior: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const contexto = await contextoCom("vistoria.registrar");
  if (!contexto) return semPermissao();
  const vistoriaId = id(formData.get("vistoriaId"));
  const recebimentoId = id(formData.get("recebimentoId"));
  if (!vistoriaId) return falha("Vistoria inválida.");
  const supabase = await createSupabaseServerClient();
  const { data: vistoria } = await supabase
    .from("vistorias")
    .select("modelo_id, status")
    .eq("id", vistoriaId)
    .eq("empresa_id", contexto.empresa.id)
    .maybeSingle();
  if (vistoria?.status !== "RASCUNHO") return falha("Vistoria não encontrada ou já concluída.");
  const { data: perguntas } = await supabase
    .from("perguntas_checklist")
    .select("id, tipo_resposta, opcoes")
    .eq("modelo_id", vistoria.modelo_id);
  const lista = (perguntas ?? []).map((p) => ({
    id: p.id,
    tipoResposta: p.tipo_resposta,
    opcoes: Array.isArray(p.opcoes)
      ? p.opcoes.filter((o): o is string => typeof o === "string")
      : null,
  }));
  const campos = Object.fromEntries(
    [...formData.entries()].filter(([, v]) => typeof v === "string") as [string, string][],
  );
  const { respostas, erros } = lerRespostas(lista, campos);
  if (Object.keys(erros).length) return falha(REVISE, { errosCampo: erros, valores: campos });

  // Perguntas sem resposta enviam null (remove a resposta anterior).
  const payload = Object.fromEntries(lista.map((p) => [p.id, respostas.get(p.id) ?? null]));
  const { error } = await supabase.rpc("rpc_salvar_respostas_vistoria", {
    p_vistoria: vistoriaId,
    p_respostas: payload,
  });
  if (error) return falha(traduzirErroBanco(error).mensagem, { valores: campos });
  if (recebimentoId) revalidar(recebimentoId);
  revalidatePath(`/vistorias/${vistoriaId}`);
  return sucesso("Respostas salvas.");
}

// ------------------------------------------------- confirmação e desfechos --
export async function confirmarRecebimento(formData: FormData): Promise<EstadoAcao> {
  const contexto = await contextoCom("recebimento.registrar");
  if (!contexto) return semPermissao();
  const recebimentoId = id(formData.get("id"));
  if (!recebimentoId) return falha("Recebimento inválido.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("rpc_confirmar_recebimento", {
    p_recebimento: recebimentoId,
  });
  if (error) return falha(traduzirErroBanco(error).mensagem);
  revalidar(recebimentoId);
  revalidatePath("/bens");
  redirect(
    `/recebimentos/${recebimentoId}?${data === "CONFIRMADO" ? "confirmado" : "aguardando"}=1`,
  );
}

export async function autorizarExcesso(formData: FormData): Promise<EstadoAcao> {
  const contexto = await contextoCom("recebimento.autorizar_excesso");
  if (!contexto) return semPermissao();
  const recebimentoId = id(formData.get("id"));
  const motivo = justificativaSchema.safeParse(formData.get("motivo") ?? "");
  if (!recebimentoId) return falha("Recebimento inválido.");
  if (!motivo.success) return falha(motivo.error.issues[0]?.message ?? "Informe a justificativa.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_autorizar_excesso", {
    p_recebimento: recebimentoId,
    p_justificativa: motivo.data,
  });
  if (error) return falha(traduzirErroBanco(error).mensagem);
  revalidar(recebimentoId);
  revalidatePath("/bens");
  redirect(`/recebimentos/${recebimentoId}?confirmado=1`);
}

export async function reabrirRecebimento(formData: FormData): Promise<EstadoAcao> {
  const contexto = await contextoCom("recebimento.registrar");
  if (!contexto) return semPermissao();
  const recebimentoId = id(formData.get("id"));
  if (!recebimentoId) return falha("Recebimento inválido.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_reabrir_recebimento", { p_recebimento: recebimentoId });
  if (error) return falha(traduzirErroBanco(error).mensagem);
  revalidar(recebimentoId);
  redirect(etapa(recebimentoId, "itens"));
}

export async function descartarRecebimento(formData: FormData): Promise<EstadoAcao> {
  await exigirContexto();
  const recebimentoId = id(formData.get("id"));
  const motivo = justificativaSchema.safeParse(formData.get("motivo") ?? "");
  if (!recebimentoId) return falha("Recebimento inválido.");
  if (!motivo.success) return falha(motivo.error.issues[0]?.message ?? "Informe o motivo.");
  // Autor ou ADMIN: decidido pela função de domínio (precisa do autor do rascunho).
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_descartar_recebimento", {
    p_recebimento: recebimentoId,
    p_motivo: motivo.data,
  });
  if (error) return falha(traduzirErroBanco(error).mensagem);
  revalidar(recebimentoId);
  redirect(`/recebimentos/${recebimentoId}?descartado=1`);
}

export async function cancelarRecebimentoConfirmado(formData: FormData): Promise<EstadoAcao> {
  const contexto = await contextoCom("recebimento.cancelar_confirmado");
  if (!contexto) return semPermissao();
  const recebimentoId = id(formData.get("id"));
  const motivo = justificativaSchema.safeParse(formData.get("motivo") ?? "");
  if (!recebimentoId) return falha("Recebimento inválido.");
  if (!motivo.success) return falha(motivo.error.issues[0]?.message ?? "Informe o motivo.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_cancelar_recebimento_confirmado", {
    p_recebimento: recebimentoId,
    p_motivo: motivo.data,
  });
  if (error) return falha(traduzirErroBanco(error).mensagem);
  revalidar(recebimentoId);
  revalidatePath("/bens");
  redirect(`/recebimentos/${recebimentoId}?cancelado=1`);
}
