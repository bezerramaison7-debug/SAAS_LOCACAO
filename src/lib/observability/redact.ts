/** Fragmentos de nome de chave cujo valor nunca pode ir para log. */
const CHAVES_SENSIVEIS = [
  "senha",
  "password",
  "token",
  "secret",
  "segredo",
  "authorization",
  "cookie",
  "apikey",
  "api_key",
  "service_role",
  "key",
  "jwt",
] as const;

export const VALOR_OCULTO = "[OCULTO]";

export function chaveSensivel(chave: string): boolean {
  const normalizada = chave.toLowerCase().replace(/-/g, "_");
  return CHAVES_SENSIVEIS.some((fragmento) => normalizada.includes(fragmento));
}

/**
 * Copia profunda do valor substituindo campos sensíveis. Binários são
 * resumidos pelo tamanho; ciclos e profundidade excessiva são cortados.
 */
export function redact(valor: unknown, profundidade = 0, vistos = new WeakSet<object>()): unknown {
  if (valor === null || valor === undefined) return valor;
  if (typeof valor !== "object") return valor;
  if (profundidade > 6) return "[PROFUNDIDADE]";
  if (vistos.has(valor)) return "[CICLO]";
  vistos.add(valor);

  if (valor instanceof Error) {
    return { name: valor.name, message: valor.message };
  }
  if (valor instanceof Date) return valor.toISOString();
  if (valor instanceof ArrayBuffer || ArrayBuffer.isView(valor)) {
    return `[BINÁRIO ${valor.byteLength} bytes]`;
  }
  if (Array.isArray(valor)) {
    return valor.map((item) => redact(item, profundidade + 1, vistos));
  }

  const saida: Record<string, unknown> = {};
  for (const [chave, item] of Object.entries(valor)) {
    saida[chave] = chaveSensivel(chave) ? VALOR_OCULTO : redact(item, profundidade + 1, vistos);
  }
  return saida;
}
