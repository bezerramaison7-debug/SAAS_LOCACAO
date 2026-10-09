import Link from "next/link";

import { cn } from "@/components/ui/cn";

import { ETAPAS_RECEBIMENTO, ROTULO_ETAPA_RECEBIMENTO, type EtapaRecebimento } from "../rotulos";

/** Etapas do recebimento (a etapa 1, locação, é a criação do rascunho). */
export function EtapasRecebimento({ id, atual }: { id: string; atual: EtapaRecebimento }) {
  const indice = ETAPAS_RECEBIMENTO.indexOf(atual);
  return (
    <nav
      aria-label="Etapas do recebimento"
      className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
    >
      <ol className="flex min-w-max gap-1 lg:min-w-0 lg:flex-wrap">
        {ETAPAS_RECEBIMENTO.map((e, i) => {
          const conteudo = (
            <>
              <span
                aria-hidden
                className={cn(
                  "flex size-7 items-center justify-center rounded-full border text-sm font-semibold",
                  i === indice
                    ? "border-primaria bg-primaria text-primaria-contraste"
                    : "border-borda-forte",
                )}
              >
                {i + 2}
              </span>
              <span>{ROTULO_ETAPA_RECEBIMENTO[e]}</span>
            </>
          );
          const classe = cn(
            "flex min-h-11 items-center gap-2 rounded-md px-3",
            i === indice
              ? "bg-superficie-2 font-semibold"
              : "text-texto-suave hover:bg-superficie-2",
          );
          return (
            <li key={e}>
              {i === indice ? (
                <span className={classe} aria-current="step">
                  {conteudo}
                </span>
              ) : (
                <Link href={`/recebimentos/${id}?etapa=${e}`} className={classe}>
                  {conteudo}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
