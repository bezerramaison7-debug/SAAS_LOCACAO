import { cookies } from "next/headers";

import { MenuUsuario } from "@/components/layout/menu-usuario";
import { MobileNav } from "@/components/layout/mobile-nav";
import { navegacaoPara } from "@/components/layout/navegacao";
import {
  COOKIE_SIDEBAR,
  COOKIE_TEMA,
  lerSidebarRecolhida,
  lerTema,
} from "@/components/layout/preferencias";
import { Sidebar } from "@/components/layout/sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { exigirContexto } from "@/lib/auth/contexto";

/**
 * Casca das telas autenticadas. A sessão e a empresa são verificadas AQUI no
 * servidor (o proxy só renova cookies) e novamente em cada action e no banco.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const contexto = await exigirContexto();
  const cookieStore = await cookies();
  const tema = lerTema(cookieStore.get(COOKIE_TEMA)?.value);
  const recolhida = lerSidebarRecolhida(cookieStore.get(COOKIE_SIDEBAR)?.value);
  const permitidos = navegacaoPara(contexto.permissoes).map((i) => i.href);

  return (
    <div className="flex min-h-dvh">
      <Sidebar recolhidaInicial={recolhida} permitidos={permitidos} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-borda bg-superficie px-4">
          <span className="truncate font-semibold lg:hidden">Rastreio de Locações</span>
          <span className="hidden lg:block" />
          <div className="flex min-w-0 items-center gap-2">
            <MenuUsuario contexto={contexto} />
            <ThemeToggle temaInicial={tema} />
          </div>
        </header>
        <main id="conteudo" className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-24 lg:pb-8">
          {children}
        </main>
      </div>
      <MobileNav permitidos={permitidos} />
    </div>
  );
}
