import { type Page, type TestInfo } from "@playwright/test";

export type Dispositivo = "celular" | "tablet" | "desktop";

export function dispositivo(testInfo: TestInfo): Dispositivo {
  const nome = testInfo.project.name;
  if (nome.includes("celular")) return "celular";
  if (nome.includes("tablet")) return "tablet";
  return "desktop";
}

/** Rotas do shell existentes nesta fase (devem continuar válidas nas próximas). */
export const ROTAS_MODULOS = [
  "/dashboard",
  "/locacoes",
  "/recebimentos",
  "/bens",
  "/movimentacoes",
  "/vistorias",
  "/ocorrencias",
  "/devolucoes",
  "/cobrancas",
  "/relatorios",
  "/configuracoes",
] as const;

export async function larguraExcedente(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}
