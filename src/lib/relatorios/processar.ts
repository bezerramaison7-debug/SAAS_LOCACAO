import "server-only";

import { randomUUID } from "node:crypto";

import { renderToBuffer } from "@react-pdf/renderer";

import { serverEnv } from "@/lib/env/server";
import { logger } from "@/lib/observability/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { falhaTransitoria } from "./falhas";
import { normalizarFoto } from "./fotos";
import { assinarRelatorio, jsonCanonico, sha256Hex } from "./integridade";
import { DocumentoRelatorio, type FotoPdf } from "./pdf/documento";
import { snapshotSchema } from "./snapshot";

/** Máximo de fotos por relatório (architecture §9). */
export const LIMITE_FOTOS = 300;
const CONCORRENCIA_DOWNLOAD = 6;

/**
 * Worker de relatórios (D-16). Roda com service_role porque não há sessão de
 * usuário; a autorização de quem pediu já foi validada no pedido
 * (`rpc_solicitar_relatorio`) e o snapshot é sempre filtrado pela empresa do job.
 * Processa até `maximo` jobs e devolve quantos concluiu ou falharam.
 */
export async function processarFila(maximo = 3): Promise<{ concluidos: number; falhas: number }> {
  const admin = createSupabaseAdminClient();
  let concluidos = 0;
  let falhas = 0;
  for (let i = 0; i < maximo; i++) {
    const { data: job, error } = await admin.rpc("relatorio_reivindicar");
    if (error) {
      logger.error("relatorio.fila.falhou", { modulo: "relatorios", erro: error });
      break;
    }
    if (!job?.id) break;
    try {
      await processarJob(job.id, job.empresa_id);
      concluidos++;
    } catch (erro) {
      falhas++;
      logger.error("relatorio.processamento.falhou", {
        modulo: "relatorios",
        relatorio_id: job.id,
        empresa_id: job.empresa_id,
        erro,
      });
      await admin.rpc("relatorio_falhar", {
        p_relatorio: job.id,
        p_erro: "Falha ao gerar o PDF. Uma nova tentativa será feita automaticamente.",
      });
    }
  }
  return { concluidos, falhas };
}

async function processarJob(id: string, empresaId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data: bruto, error } = await admin.rpc("relatorio_snapshot", {
    p_relatorio: id,
    p_limite_fotos: LIMITE_FOTOS,
  });
  if (error || !bruto) throw error ?? new Error("Snapshot vazio");
  const snapshot = snapshotSchema.parse(bruto);
  const hashDados = sha256Hex(jsonCanonico(bruto));

  // Fotos baixadas do storage privado e normalizadas — ninguém manipula arquivo à mão.
  const fila = snapshot.evidencias.filter((e) => e.mime.startsWith("image/"));
  const fotos: FotoPdf[] = new Array(fila.length);
  for (let i = 0; i < fila.length; i += CONCORRENCIA_DOWNLOAD) {
    await Promise.all(
      fila.slice(i, i + CONCORRENCIA_DOWNLOAD).map(async (evidencia, j) => {
        const { data, error: erroFoto } = await admin.storage
          .from(evidencia.bucket)
          .download(evidencia.storage_path);
        // O relatório concluído é imutável: falha de rede não pode virar
        // "imagem indisponível" — o job falha e é tentado de novo.
        if (erroFoto && falhaTransitoria(erroFoto)) throw erroFoto;
        const jpeg = data ? await normalizarFoto(new Uint8Array(await data.arrayBuffer())) : null;
        fotos[i + j] = { evidencia, jpeg };
      }),
    );
  }

  const geradoEm = new Date().toISOString();
  const pdf = await renderToBuffer(DocumentoRelatorio({ snapshot, hashDados, geradoEm, fotos }));
  const hashArquivo = sha256Hex(pdf);
  const assinatura = assinarRelatorio(serverEnv.REPORT_SIGNING_SECRET, {
    id,
    hashDados,
    hashArquivo,
  });
  // Uma nova tentativa imediata para falha transitória (caminho novo, sem sobrescrever).
  let caminho = "";
  for (let tentativa = 1; ; tentativa++) {
    caminho = `${empresaId}/relatorio/${id}/${randomUUID()}.pdf`;
    const envio = await admin.storage
      .from("relatorios")
      .upload(caminho, pdf, { contentType: "application/pdf", upsert: false });
    if (!envio.error) break;
    if (tentativa >= 2 || !falhaTransitoria(envio.error)) throw envio.error;
    logger.warn("relatorio.envio.retentativa", { modulo: "relatorios", relatorio_id: id });
    await new Promise((r) => setTimeout(r, 1000));
  }
  const { error: erroConclusao } = await admin.rpc("relatorio_concluir", {
    p_relatorio: id,
    p_storage_path: caminho,
    p_hash_arquivo: hashArquivo,
    p_hash_dados: hashDados,
    p_assinatura: assinatura,
  });
  if (erroConclusao) {
    await admin.storage.from("relatorios").remove([caminho]);
    throw erroConclusao;
  }
  logger.info("relatorio.concluido", {
    modulo: "relatorios",
    relatorio_id: id,
    empresa_id: empresaId,
    fotos: fotos.length,
    bytes: pdf.length,
  });
}
