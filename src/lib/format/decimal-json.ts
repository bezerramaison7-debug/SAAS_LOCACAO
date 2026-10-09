import Decimal from "decimal.js";

/**
 * O cliente tipado do Supabase envia `numeric` como número JSON. Esta função
 * só converte quando a conversão é EXATA (ida e volta preservam o decimal);
 * caso contrário lança — nunca se perde precisão silenciosamente (RN-101).
 * Leituras usam `::text` nas consultas, mantendo string decimal.
 */
export function decimalParaJson(valor: string): number {
  const decimal = new Decimal(valor);
  const numero = decimal.toNumber();
  if (!new Decimal(String(numero)).equals(decimal)) {
    throw new RangeError(`Valor ${valor} não pode ser transportado sem perda de precisão`);
  }
  return numero;
}
