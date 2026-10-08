export type OpcoesCsp = {
  nonce: string;
  supabaseUrl: string;
  dev: boolean;
};

/** Nonce aleatório (128 bits) em base64 para a CSP da requisição. */
export function gerarNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Content-Security-Policy estrita com nonce. O Supabase é liberado em
 * `connect-src` (API/Auth) e `img-src` (URLs assinadas de evidências).
 * `style-src-attr 'unsafe-inline'` é necessário para o posicionamento de
 * componentes Radix (atributo style); scripts inline continuam bloqueados.
 */
export function montarCsp({ nonce, supabaseUrl, dev }: OpcoesCsp): string {
  const supabase = new URL(supabaseUrl).origin;
  const diretivas: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(dev ? ["'unsafe-eval'"] : []),
    ],
    "style-src": ["'self'", `'nonce-${nonce}'`, ...(dev ? ["'unsafe-inline'"] : [])],
    "style-src-attr": ["'unsafe-inline'"],
    "img-src": ["'self'", "blob:", "data:", supabase],
    "font-src": ["'self'"],
    "connect-src": ["'self'", supabase, ...(dev ? ["ws:"] : [])],
    "media-src": ["'self'", "blob:"],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  const politica = Object.entries(diretivas).map(([nome, fontes]) => `${nome} ${fontes.join(" ")}`);
  if (!dev) politica.push("upgrade-insecure-requests");
  return politica.join("; ");
}
