export const REQUEST_ID_HEADER = "x-request-id";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Reaproveita um request id recebido apenas se for um UUID válido
 * (evita injeção de conteúdo arbitrário em logs); caso contrário gera outro.
 */
export function resolverRequestId(recebido: string | null | undefined): string {
  if (recebido && UUID_RE.test(recebido)) return recebido.toLowerCase();
  return crypto.randomUUID();
}
