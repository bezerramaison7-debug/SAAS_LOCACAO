"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog } from "radix-ui";
import { useState } from "react";

import { cn } from "@/components/ui/cn";

import { itemAtivo, NAVEGACAO } from "./navegacao";

const classeItem =
  "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-xs text-texto-suave";

/** Navegação compacta inferior (< 1024px): atalhos + "Mais" com o menu completo. */
export function MobileNav() {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const atalhos = NAVEGACAO.filter((item) => item.atalhoMovel);

  return (
    <nav
      aria-label="Menu principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-borda bg-superficie pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="flex">
        {atalhos.map(({ href, rotulo, icone: Icone }) => {
          const ativo = itemAtivo(pathname, href);
          return (
            <li key={href} className="flex flex-1">
              <Link
                href={href}
                aria-current={ativo ? "page" : undefined}
                className={cn(classeItem, ativo && "font-semibold text-primaria")}
              >
                <Icone aria-hidden className="size-6" />
                <span>{rotulo}</span>
              </Link>
            </li>
          );
        })}
        <li className="flex flex-1">
          <Dialog.Root open={aberto} onOpenChange={setAberto}>
            <Dialog.Trigger className={classeItem}>
              <Menu aria-hidden className="size-6" />
              <span>Mais</span>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
              <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-xl border-t border-borda bg-superficie p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <div className="mb-2 flex items-center justify-between">
                  <Dialog.Title className="text-lg font-semibold">Menu</Dialog.Title>
                  <Dialog.Close
                    aria-label="Fechar menu"
                    className="inline-flex size-11 items-center justify-center rounded-md hover:bg-superficie-2"
                  >
                    <X aria-hidden />
                  </Dialog.Close>
                </div>
                <Dialog.Description className="sr-only">
                  Todos os módulos do sistema
                </Dialog.Description>
                <ul className="space-y-1">
                  {NAVEGACAO.map(({ href, rotulo, icone: Icone }) => {
                    const ativo = itemAtivo(pathname, href);
                    return (
                      <li key={href}>
                        <Link
                          href={href}
                          onClick={() => setAberto(false)}
                          aria-current={ativo ? "page" : undefined}
                          className={cn(
                            "flex min-h-12 items-center gap-3 rounded-md px-3 hover:bg-superficie-2",
                            ativo && "bg-primaria-suave font-semibold text-primaria",
                          )}
                        >
                          <Icone aria-hidden className="size-5" />
                          {rotulo}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </li>
      </ul>
    </nav>
  );
}
