/**
 * Valida destinos de redirecionamento (`?next=`) para evitar open redirect:
 * apenas caminhos internos absolutos, sem esquema, sem `//` e sem barra invertida.
 */
export function destinoSeguro(destino: string | null | undefined, padrao = "/dashboard"): string {
  if (!destino || typeof destino !== "string") return padrao;
  if (!destino.startsWith("/") || destino.startsWith("//") || destino.includes("\\")) return padrao;
  if (/[\u0000-\u001f]/.test(destino)) return padrao;
  try {
    const url = new URL(destino, "http://interno.local");
    if (url.origin !== "http://interno.local") return padrao;
    return `${url.pathname}${url.search}`;
  } catch {
    return padrao;
  }
}

/** Rotas acessíveis sem sessão. */
// O worker de relatórios não tem sessão: é protegido pelo segredo (D-16).
const PUBLICAS = ["/login", "/recuperar-senha", "/auth/", "/api/health", "/api/reports/process"];

export function rotaPublica(pathname: string): boolean {
  return PUBLICAS.some((p) =>
    p.endsWith("/") ? pathname.startsWith(p) : pathname === p || pathname.startsWith(`${p}/`),
  );
}
