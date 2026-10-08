export const COOKIE_TEMA = "tema";
export const COOKIE_SIDEBAR = "sidebar";

export const TEMAS = ["sistema", "claro", "escuro"] as const;
export type Tema = (typeof TEMAS)[number];

export function lerTema(valor: string | undefined): Tema {
  return (TEMAS as readonly string[]).includes(valor ?? "") ? (valor as Tema) : "sistema";
}

export function lerSidebarRecolhida(valor: string | undefined): boolean {
  return valor === "recolhida";
}

/** Preferência visual (não sensível): cookie legível no cliente, 1 ano. */
export function gravarCookiePreferencia(nome: string, valor: string): void {
  const seguro = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${nome}=${encodeURIComponent(valor)}; Path=/; Max-Age=31536000; SameSite=Lax${seguro}`;
}
