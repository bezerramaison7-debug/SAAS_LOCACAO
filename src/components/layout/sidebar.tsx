"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { cn } from "@/components/ui/cn";

import { itemAtivo, NAVEGACAO } from "./navegacao";

/** `permitidos`: hrefs liberados pelo servidor (ícones não são serializáveis). */
type PropsNavegacao = { permitidos: readonly string[] };
import { COOKIE_SIDEBAR, gravarCookiePreferencia } from "./preferencias";

/** Navegação lateral recolhível (≥ 1024px). Estado persistido em cookie. */
export function Sidebar({
  recolhidaInicial,
  permitidos,
}: PropsNavegacao & { recolhidaInicial: boolean }) {
  const pathname = usePathname();
  const [recolhida, setRecolhida] = useState(recolhidaInicial);

  function alternar() {
    const nova = !recolhida;
    setRecolhida(nova);
    gravarCookiePreferencia(COOKIE_SIDEBAR, nova ? "recolhida" : "expandida");
  }

  return (
    <aside
      data-recolhida={recolhida}
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-borda bg-superficie lg:flex",
        recolhida ? "w-[4.5rem]" : "w-72",
      )}
    >
      <div className="flex h-16 items-center justify-between gap-2 border-b border-borda px-3">
        {!recolhida ? (
          <Link href="/dashboard" className="truncate px-2 text-base font-semibold">
            Rastreio de Locações
          </Link>
        ) : null}
        <button
          type="button"
          onClick={alternar}
          aria-expanded={!recolhida}
          aria-label={recolhida ? "Expandir menu" : "Recolher menu"}
          className="inline-flex size-11 items-center justify-center rounded-md text-texto-suave hover:bg-superficie-2"
        >
          {recolhida ? <PanelLeftOpen aria-hidden /> : <PanelLeftClose aria-hidden />}
        </button>
      </div>
      <nav aria-label="Menu principal" className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          {NAVEGACAO.filter((i) => permitidos.includes(i.href)).map(
            ({ href, rotulo, icone: Icone }) => {
              const ativo = itemAtivo(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={ativo ? "page" : undefined}
                    title={recolhida ? rotulo : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-md px-3 text-texto hover:bg-superficie-2",
                      ativo && "bg-primaria-suave font-semibold text-primaria",
                      recolhida && "justify-center px-0",
                    )}
                  >
                    <Icone aria-hidden className="size-5 shrink-0" />
                    <span className={cn(recolhida && "sr-only")}>{rotulo}</span>
                  </Link>
                </li>
              );
            },
          )}
        </ul>
      </nav>
    </aside>
  );
}
