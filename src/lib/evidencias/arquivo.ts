/**
 * Validação de arquivos de evidência (RN-92). O tipo é detectado pelos
 * primeiros bytes (magic bytes) — nunca pela extensão ou pelo Content-Type
 * enviados pelo navegador.
 */

export const TIPOS_EVIDENCIA = ["FOTO", "DOCUMENTO", "CONTRATO", "COMPROVANTE"] as const;
export type TipoEvidencia = (typeof TIPOS_EVIDENCIA)[number];

export const ENTIDADES_EVIDENCIA = [
  "LOCACAO",
  "RECEBIMENTO",
  "ITEM_RECEBIMENTO",
  "BEM",
  "LOTE",
  "VISTORIA",
  "RESPOSTA_VISTORIA",
  "MOVIMENTACAO",
  "OCORRENCIA",
  "DEVOLUCAO",
  "COBRANCA",
] as const;
export type EntidadeEvidencia = (typeof ENTIDADES_EVIDENCIA)[number];

export type MimeEvidencia = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

export const EXTENSAO: Record<MimeEvidencia, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/** Teto absoluto (bucket); o limite efetivo é o da empresa, informado pelo banco. */
export const TAMANHO_MAXIMO_BYTES = 20 * 1024 * 1024;

function comeca(bytes: Uint8Array, assinatura: readonly number[], deslocamento = 0): boolean {
  return assinatura.every((b, i) => bytes[deslocamento + i] === b);
}

export function detectarMime(bytes: Uint8Array): MimeEvidencia | null {
  if (comeca(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (comeca(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // RIFF....WEBP
  if (comeca(bytes, [0x52, 0x49, 0x46, 0x46]) && comeca(bytes, [0x57, 0x45, 0x42, 0x50], 8))
    return "image/webp";
  if (comeca(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
  return null;
}

/** Tipos aceitos por contexto: foto só imagem; documentos aceitam PDF. */
export function mimesPermitidos(tipo: TipoEvidencia): readonly MimeEvidencia[] {
  return tipo === "FOTO"
    ? ["image/jpeg", "image/png", "image/webp"]
    : ["image/jpeg", "image/png", "image/webp", "application/pdf"];
}

export const BUCKET: Record<TipoEvidencia, "evidencias" | "contratos" | "comprovantes"> = {
  FOTO: "evidencias",
  DOCUMENTO: "evidencias",
  CONTRATO: "contratos",
  COMPROVANTE: "comprovantes",
};

export type Limites = { imagemBytes: number; pdfBytes: number };

export type ResultadoValidacao =
  { ok: true; mime: MimeEvidencia; extensao: string } | { ok: false; erro: string };

export function validarArquivo(
  bytes: Uint8Array,
  tipo: TipoEvidencia,
  limites: Limites,
): ResultadoValidacao {
  if (bytes.byteLength === 0) return { ok: false, erro: "Arquivo vazio." };
  const mime = detectarMime(bytes);
  if (!mime) return { ok: false, erro: "Formato não aceito. Envie JPG, PNG, WEBP ou PDF." };
  if (!mimesPermitidos(tipo).includes(mime)) {
    return { ok: false, erro: "Para fotos, envie uma imagem (JPG, PNG ou WEBP)." };
  }
  const limite = Math.min(
    mime === "application/pdf" ? limites.pdfBytes : limites.imagemBytes,
    TAMANHO_MAXIMO_BYTES,
  );
  if (bytes.byteLength > limite) {
    return { ok: false, erro: `Arquivo acima do limite de ${Math.floor(limite / 1048576)} MB.` };
  }
  return { ok: true, mime, extensao: EXTENSAO[mime] };
}

/** RN-91: {empresa_id}/{entidade_tipo}/{entidade_id}/{uuid}.{ext} — nome original só como metadado. */
export function caminhoEvidencia(
  empresaId: string,
  entidade: EntidadeEvidencia,
  entidadeId: string,
  arquivoId: string,
  extensao: string,
): string {
  return `${empresaId}/${entidade.toLowerCase()}/${entidadeId}/${arquivoId}.${extensao}`;
}

/** Nome original seguro para metadado/download (sem caminhos nem controle). */
export function nomeSeguro(nome: string): string | null {
  const base = nome.split(/[\\/]/).pop() ?? "";
  const limpo = base
    .replace(/[\u0000-\u001f\u007f"<>]/g, "")
    .trim()
    .slice(0, 255);
  return limpo || null;
}
