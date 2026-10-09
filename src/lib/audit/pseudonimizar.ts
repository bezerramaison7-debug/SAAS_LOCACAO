import { createHmac } from "node:crypto";

/**
 * Pseudonimiza e-mail/IP com HMAC (chave do servidor): permite correlacionar
 * tentativas sem armazenar o dado em claro nem permitir dicionário offline.
 */
export function pseudonimizar(valor: string, segredo: string): string {
  return createHmac("sha256", `auditoria-autenticacao:${segredo}`)
    .update(valor.trim().toLowerCase())
    .digest("hex");
}
