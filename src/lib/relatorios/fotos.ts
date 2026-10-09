import "server-only";

import sharp from "sharp";

/** Lado máximo das fotos no PDF (D-16): legível impresso, sem inflar o arquivo. */
export const LADO_MAXIMO = 1600;

/**
 * Normaliza a foto para o PDF: aplica a orientação EXIF, remove metadados,
 * limita o tamanho e converte para JPEG. Imagem corrompida → `null`
 * (o PDF registra a indisponibilidade com o hash do original).
 */
export async function normalizarFoto(original: Uint8Array): Promise<Buffer | null> {
  try {
    return await sharp(original, { failOn: "error", limitInputPixels: 80_000_000 })
      .rotate()
      .resize({ width: LADO_MAXIMO, height: LADO_MAXIMO, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 72, mozjpeg: true })
      .toBuffer();
  } catch {
    return null;
  }
}
