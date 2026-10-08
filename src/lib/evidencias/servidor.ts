import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { z } from "zod";

import { traduzirErroBanco } from "@/lib/db/erros";
import { logger } from "@/lib/observability/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/comum";

import {
  BUCKET,
  caminhoEvidencia,
  ENTIDADES_EVIDENCIA,
  nomeSeguro,
  TAMANHO_MAXIMO_BYTES,
  TIPOS_EVIDENCIA,
  validarArquivo,
} from "./arquivo";

const opcional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), schema.optional());

export const metadadosEnvioSchema = z.object({
  entidadeTipo: z.enum(ENTIDADES_EVIDENCIA),
  entidadeId: uuidSchema,
  tipo: z.enum(TIPOS_EVIDENCIA),
  perguntaId: opcional(uuidSchema),
  substitui: opcional(uuidSchema),
  legenda: opcional(z.string().trim().max(500)),
  // RN-93: informada pelo dispositivo (não confiável) — rotulada como tal.
  capturadaEm: opcional(z.iso.datetime({ offset: true })),
  latitude: opcional(z.coerce.number().min(-90).max(90)),
  longitude: opcional(z.coerce.number().min(-180).max(180)),
});
export type MetadadosEnvio = z.infer<typeof metadadosEnvioSchema>;

export type ResultadoEnvio = { ok: true; id: string } | { ok: false; status: number; erro: string };

/**
 * Fluxo (D-07, D-49):
 *  1. autorização no banco com o JWT do usuário (rpc_preparar_evidencia);
 *  2. validação do conteúdo (magic bytes, limite da empresa) e SHA-256;
 *  3. gravação no bucket privado com service role (única escrita permitida);
 *  4. registro com o JWT do usuário (revalida tudo); se falhar, o objeto é apagado.
 */
export async function enviarEvidencia(
  meta: MetadadosEnvio,
  arquivo: File,
  requestId: string,
): Promise<ResultadoEnvio> {
  const supabase = await createSupabaseServerClient();
  const contexto = { request_id: requestId, modulo: "evidencias", operacao: "enviar" };

  // Substituição: a entidade e o tipo vêm da evidência antiga (lida pela RLS).
  let alvo = {
    entidadeTipo: meta.entidadeTipo,
    entidadeId: meta.entidadeId,
    tipo: meta.tipo,
    pergunta: meta.perguntaId,
  };
  if (meta.substitui) {
    const { data: antiga } = await supabase
      .from("evidencias")
      .select("entidade_tipo, entidade_id, tipo, pergunta_id, status")
      .eq("id", meta.substitui)
      .maybeSingle();
    if (!antiga) return { ok: false, status: 404, erro: "Evidência não encontrada." };
    alvo = {
      entidadeTipo: antiga.entidade_tipo,
      entidadeId: antiga.entidade_id,
      tipo: antiga.tipo,
      pergunta: antiga.pergunta_id ?? undefined,
    };
  }

  const { data: preparo, error: erroPreparo } = await supabase
    .rpc("rpc_preparar_evidencia", {
      p_entidade_tipo: alvo.entidadeTipo,
      p_entidade_id: alvo.entidadeId,
      p_tipo: alvo.tipo,
      ...(alvo.pergunta ? { p_pergunta: alvo.pergunta } : {}),
    })
    .maybeSingle();
  if (erroPreparo || !preparo) {
    const erro = traduzirErroBanco(erroPreparo);
    const status =
      erro.codigo === "SEM_PERMISSAO" ? 403 : erro.codigo === "NAO_ENCONTRADO" ? 404 : 422;
    return { ok: false, status, erro: erro.mensagem };
  }

  if (arquivo.size > TAMANHO_MAXIMO_BYTES)
    return { ok: false, status: 413, erro: "Arquivo muito grande." };
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const validacao = validarArquivo(bytes, alvo.tipo, {
    imagemBytes: Number(preparo.limite_imagem_bytes),
    pdfBytes: Number(preparo.limite_pdf_bytes),
  });
  if (!validacao.ok) return { ok: false, status: 422, erro: validacao.erro };

  const hash = createHash("sha256").update(bytes).digest("hex");
  const caminho = caminhoEvidencia(
    preparo.empresa_id,
    alvo.entidadeTipo,
    alvo.entidadeId,
    randomUUID(),
    validacao.extensao,
  );
  const bucket = BUCKET[alvo.tipo];
  const admin = createSupabaseAdminClient();
  const { error: erroUpload } = await admin.storage.from(bucket).upload(caminho, bytes, {
    contentType: validacao.mime,
    upsert: false,
    cacheControl: "private, max-age=0",
  });
  if (erroUpload) {
    logger.error("evidencia.upload_falhou", {
      ...contexto,
      empresa_id: preparo.empresa_id,
      erro_codigo: erroUpload.name,
    });
    return {
      ok: false,
      status: 503,
      erro: "Não foi possível armazenar o arquivo. Tente novamente.",
    };
  }

  const comuns = {
    p_storage_path: caminho,
    p_mime_type: validacao.mime,
    p_tamanho_bytes: bytes.byteLength,
    p_hash: hash,
    ...(nomeSeguro(arquivo.name) ? { p_nome_original: nomeSeguro(arquivo.name) as string } : {}),
    ...(meta.capturadaEm ? { p_capturada_em: meta.capturadaEm } : {}),
    ...(meta.latitude !== undefined && meta.longitude !== undefined
      ? { p_latitude: meta.latitude, p_longitude: meta.longitude }
      : {}),
    ...(meta.legenda ? { p_legenda: meta.legenda } : {}),
  };
  const { data: id, error: erroRegistro } = meta.substitui
    ? await supabase.rpc("rpc_substituir_evidencia", { p_antiga: meta.substitui, ...comuns })
    : await supabase.rpc("rpc_registrar_evidencia", {
        p_entidade_tipo: alvo.entidadeTipo,
        p_entidade_id: alvo.entidadeId,
        p_tipo: alvo.tipo,
        ...(alvo.pergunta ? { p_pergunta: alvo.pergunta } : {}),
        ...comuns,
      });
  if (erroRegistro || !id) {
    // Sem registro não pode haver arquivo órfão.
    await admin.storage.from(bucket).remove([caminho]);
    const erro = traduzirErroBanco(erroRegistro);
    return { ok: false, status: erro.codigo === "SEM_PERMISSAO" ? 403 : 422, erro: erro.mensagem };
  }
  logger.info("evidencia.registrada", {
    ...contexto,
    empresa_id: preparo.empresa_id,
    evidencia_id: id,
  });
  return { ok: true, id };
}

/**
 * URL assinada de 5 minutos (RN-94), gerada com o JWT do usuário: a policy do
 * Storage só libera objetos ligados a uma evidência que ele consegue ler.
 * Nunca persistida.
 */
export async function urlAssinada(id: string, download: boolean): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data: e } = await supabase
    .from("evidencias")
    .select("bucket, storage_path, nome_original")
    .eq("id", id)
    .maybeSingle();
  if (!e) return null;
  const { data } = await supabase.storage
    .from(e.bucket)
    .createSignedUrl(
      e.storage_path,
      300,
      download ? { download: e.nome_original ?? true } : undefined,
    );
  return data?.signedUrl ?? null;
}
