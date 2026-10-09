import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * JSON canônico (chaves ordenadas, sem espaços): a mesma informação gera
 * sempre os mesmos bytes, então o hash dos dados é reprodutível (RN-110).
 */
export function jsonCanonico(valor: unknown): string {
  if (valor === null || typeof valor !== "object") return JSON.stringify(valor ?? null);
  if (Array.isArray(valor)) return `[${valor.map(jsonCanonico).join(",")}]`;
  const entradas = Object.entries(valor as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entradas.map(([k, v]) => `${JSON.stringify(k)}:${jsonCanonico(v)}`).join(",")}}`;
}

export function sha256Hex(dados: string | Uint8Array): string {
  return createHash("sha256").update(dados).digest("hex");
}

/**
 * Assinatura do relatório: HMAC-SHA256 de id, hash dos dados e hash do
 * arquivo. Prova que o par (dados, PDF) foi emitido por este servidor.
 */
export function assinarRelatorio(
  segredo: string,
  partes: { id: string; hashDados: string; hashArquivo: string },
): string {
  return createHmac("sha256", segredo)
    .update(`relatorio:v1|${partes.id}|${partes.hashDados}|${partes.hashArquivo}`)
    .digest("hex");
}

/** Comparação em tempo constante do `Authorization: Bearer <segredo>` do worker. */
export function autorizacaoWorkerValida(cabecalho: string | null, segredo: string): boolean {
  const recebido = cabecalho?.startsWith("Bearer ") ? cabecalho.slice(7) : "";
  const a = createHash("sha256").update(recebido).digest();
  const b = createHash("sha256").update(segredo).digest();
  return recebido.length > 0 && timingSafeEqual(a, b);
}
