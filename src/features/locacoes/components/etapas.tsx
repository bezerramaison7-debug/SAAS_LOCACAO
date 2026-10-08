import Link from "next/link";

import { cn } from "@/components/ui/cn";

import { ETAPAS, ROTULO_ETAPA, type Etapa } from "../schemas";

/** Indicador de etapas. Sem id (criação) só a primeira etapa existe. */
export function EtapasLocacao({ atual, locacaoId }: { atual: Etapa; locacaoId?: string }) {
  const indiceAtual = ETAPAS.indexOf(atual);
  return (
    <nav aria-label="Etapas da locação" className="mb-6 overflow-x-auto">
      <ol className="flex min-w-max gap-2">
        {ETAPAS.map((etapa, i) => {
          const conteudo = (
            <>
              <span
                aria-hidden
                className={cn(
                  "flex size-7 items-center justify-center rounded-full border text-sm font-semibold",
                  i === indiceAtual
                    ? "border-primaria bg-primaria text-primaria-contraste"
                    : "border-borda-forte",
                )}
              >
                {i + 1}
              </span>
              <span>{ROTULO_ETAPA[etapa]}</span>
            </>
          );
          const classe = cn(
            "flex min-h-11 items-center gap-2 rounded-md px-3",
            i === indiceAtual ? "bg-superficie-2 font-semibold" : "text-texto-suave",
          );
          return (
            <li key={etapa}>
              {locacaoId && i !== indiceAtual ? (
                <Link
                  href={`/locacoes/${locacaoId}/editar?etapa=${etapa}`}
                  className={cn(classe, "hover:bg-superficie-2")}
                >
                  {conteudo}
                </Link>
              ) : (
                <span className={classe} aria-current={i === indiceAtual ? "step" : undefined}>
                  {conteudo}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
