import { ChevronLeft, ChevronRight } from "lucide-react";
import { type Route } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { formatarQuantidade } from "@/lib/format/moeda";
import { TAMANHOS_PAGINA, type Paginacao } from "@/lib/validation/comum";

import { montarUrlListagem, type ParametrosBusca } from "./url";

type PaginationProps = {
  caminho: string;
  parametros: ParametrosBusca;
  paginacao: Paginacao;
  total: number;
};

/** Paginação server-side: tudo é link (funciona sem JavaScript e preserva filtros na URL). */
export function Pagination({ caminho, parametros, paginacao, total }: PaginationProps) {
  const { pagina, tamanho } = paginacao;
  const totalPaginas = Math.max(1, Math.ceil(total / tamanho));
  const inicio = total === 0 ? 0 : (pagina - 1) * tamanho + 1;
  const fim = Math.min(pagina * tamanho, total);
  const url = (alteracoes: Record<string, string | number | null>) =>
    montarUrlListagem(caminho, parametros, alteracoes) as Route;

  return (
    <nav
      aria-label="Paginação"
      className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-texto-suave" aria-live="polite">
        {total === 0
          ? "Nenhum registro"
          : `${formatarQuantidade(String(inicio))}–${formatarQuantidade(String(fim))} de ${formatarQuantidade(String(total))}`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-texto-suave">Por página:</span>
        {TAMANHOS_PAGINA.map((opcao) => (
          <Link
            key={opcao}
            href={url({ tamanho: opcao === 25 ? null : opcao })}
            aria-current={opcao === tamanho ? "true" : undefined}
            className={cn(
              buttonVariants({ variante: opcao === tamanho ? "primaria" : "fantasma" }),
              "px-3",
            )}
          >
            {opcao}
          </Link>
        ))}
        <span className="mx-1 hidden h-6 w-px bg-borda sm:block" aria-hidden />
        {pagina > 1 ? (
          <Link
            href={url({ pagina: pagina - 1 })}
            className={buttonVariants({ tamanho: "icone" })}
            aria-label="Página anterior"
          >
            <ChevronLeft aria-hidden />
          </Link>
        ) : (
          <span className={cn(buttonVariants({ tamanho: "icone" }), "opacity-40")} aria-hidden>
            <ChevronLeft />
          </span>
        )}
        <span className="min-w-20 text-center" aria-current="page">
          {pagina} / {totalPaginas}
        </span>
        {pagina < totalPaginas ? (
          <Link
            href={url({ pagina: pagina + 1 })}
            className={buttonVariants({ tamanho: "icone" })}
            aria-label="Próxima página"
          >
            <ChevronRight aria-hidden />
          </Link>
        ) : (
          <span className={cn(buttonVariants({ tamanho: "icone" }), "opacity-40")} aria-hidden>
            <ChevronRight />
          </span>
        )}
      </div>
    </nav>
  );
}
