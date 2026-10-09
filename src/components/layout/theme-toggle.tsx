"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";

import { cn } from "@/components/ui/cn";

import { COOKIE_TEMA, gravarCookiePreferencia, type Tema } from "./preferencias";

const OPCOES: readonly { valor: Tema; rotulo: string; Icone: typeof Sun }[] = [
  { valor: "claro", rotulo: "Tema claro", Icone: Sun },
  { valor: "escuro", rotulo: "Tema escuro", Icone: Moon },
  { valor: "sistema", rotulo: "Tema do sistema", Icone: Monitor },
];

export function aplicarTema(tema: Tema): void {
  const raiz = document.documentElement;
  if (tema === "sistema") delete raiz.dataset.theme;
  else raiz.dataset.theme = tema;
}

export function ThemeToggle({ temaInicial }: { temaInicial: Tema }) {
  const [tema, setTema] = useState<Tema>(temaInicial);

  function escolher(valor: Tema) {
    setTema(valor);
    aplicarTema(valor);
    gravarCookiePreferencia(COOKIE_TEMA, valor);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Tema de cores"
      className="inline-flex rounded-md border border-borda p-0.5"
    >
      {OPCOES.map(({ valor, rotulo, Icone }) => (
        <button
          key={valor}
          type="button"
          role="radio"
          aria-checked={tema === valor}
          aria-label={rotulo}
          title={rotulo}
          onClick={() => escolher(valor)}
          className={cn(
            "inline-flex size-11 items-center justify-center rounded text-texto-suave hover:bg-superficie-2",
            tema === valor && "bg-primaria-suave text-primaria",
          )}
        >
          <Icone aria-hidden className="size-5" />
        </button>
      ))}
    </div>
  );
}
