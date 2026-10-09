"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { decimalParaJson } from "@/lib/format/decimal-json";
import { camposTexto, errosDoZod, falha, type EstadoAcao } from "@/lib/actions/estado";
import { exigirContexto } from "@/lib/auth/contexto";
import { traduzirErroBanco } from "@/lib/db/erros";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { justificativaSchema, uuidSchema } from "@/lib/validation/comum";

import { CAMPOS_COBRANCA, cobrancaSchema } from "./schemas";

function id(valor: FormDataEntryValue | null) {
  const r = uuidSchema.safeParse(valor);
  return r.success ? r.data : null;
}

const semPermissao = () => falha("Você não tem permissão para gerenciar cobranças.");

async function podeGerenciar() {
  const contexto = await exigirContexto();
  return contexto.permissoes.includes("cobranca.gerenciar") ? contexto : null;
}

function revalidar(cobranca: string | null, locacao: string | null) {
  revalidatePath("/cobrancas");
  if (cobranca) revalidatePath(`/cobrancas/${cobranca}`);
  if (locacao) revalidatePath(`/locacoes/${locacao}`);
}

export async function registrarCobranca(
  _anterior: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  if (!(await podeGerenciar())) return semPermissao();
  const locacao = id(formData.get("locacaoId"));
  if (!locacao)
    return falha("Selecione a locação.", { errosCampo: { locacaoId: "Selecione a locação" } });
  const valores = { ...camposTexto(formData, CAMPOS_COBRANCA), locacaoId: locacao };
  const dados = cobrancaSchema.safeParse(valores);
  if (!dados.success)
    return falha("Revise os campos destacados.", { errosCampo: errosDoZod(dados.error), valores });
  const d = dados.data;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("rpc_registrar_cobranca", {
    p_locacao: locacao,
    p_competencia_inicio: d.competenciaInicio,
    p_competencia_fim: d.competenciaFim,
    p_valor: decimalParaJson(d.valor),
    ...(d.numeroDocumento ? { p_numero_documento: d.numeroDocumento } : {}),
    ...(d.observacoes ? { p_observacoes: d.observacoes } : {}),
  });
  if (error || !data) return falha(traduzirErroBanco(error).mensagem, { valores });
  revalidar(data, locacao);
  redirect(`/cobrancas/${data}?registrada=1`);
}

async function transicao(
  formData: FormData,
  executar: (
    supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
    cobranca: string,
    texto: string,
  ) => PromiseLike<{ error: { code?: string; message: string } | null }>,
  aviso: string,
  exigeTexto: boolean,
): Promise<EstadoAcao> {
  if (!(await podeGerenciar())) return semPermissao();
  const cobranca = id(formData.get("id"));
  if (!cobranca) return falha("Cobrança inválida.");
  let texto = "";
  if (exigeTexto) {
    const t = justificativaSchema.safeParse(formData.get("motivo") ?? "");
    if (!t.success) return falha(t.error.issues[0]?.message ?? "Descreva o motivo.");
    texto = t.data;
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await executar(supabase, cobranca, texto);
  if (error) return falha(traduzirErroBanco(error).mensagem);
  revalidar(cobranca, null);
  redirect(`/cobrancas/${cobranca}?${aviso}=1`);
}

export async function conferirCobranca(formData: FormData): Promise<EstadoAcao> {
  return transicao(
    formData,
    (s, c) => s.rpc("rpc_conferir_cobranca", { p_cobranca: c }),
    "conferida",
    false,
  );
}

export async function marcarDivergente(formData: FormData): Promise<EstadoAcao> {
  return transicao(
    formData,
    (s, c, t) => s.rpc("rpc_marcar_cobranca_divergente", { p_cobranca: c, p_motivo: t }),
    "divergente",
    true,
  );
}

export async function resolverCobranca(formData: FormData): Promise<EstadoAcao> {
  return transicao(
    formData,
    (s, c, t) => s.rpc("rpc_resolver_cobranca", { p_cobranca: c, p_resolucao: t }),
    "resolvida",
    true,
  );
}
