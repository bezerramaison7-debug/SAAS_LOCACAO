import { cookies } from "next/headers";

import { MobileNav } from "@/components/layout/mobile-nav";
import {
  COOKIE_SIDEBAR,
  COOKIE_TEMA,
  lerSidebarRecolhida,
  lerTema,
} from "@/components/layout/preferencias";
import { Sidebar } from "@/components/layout/sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";

/**
 * Casca das telas autenticadas. A verificação de sessão/empresa/permissão
 * será adicionada aqui (e repetida em cada action) na Fase 3.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const cookieStore = await cookies();
  const tema = lerTema(cookieStore.get(COOKIE_TEMA)?.value);
  const recolhida = lerSidebarRecolhida(cookieStore.get(COOKIE_SIDEBAR)?.value);

  return (
    <div className="flex min-h-dvh">
      <Sidebar recolhidaInicial={recolhida} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-borda bg-superficie px-4">
          <span className="truncate font-semibold lg:hidden">Rastreio de Locações</span>
          <span className="hidden lg:block" />
          <ThemeToggle temaInicial={tema} />
        </header>
        <main id="conteudo" className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-24 lg:pb-8">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
