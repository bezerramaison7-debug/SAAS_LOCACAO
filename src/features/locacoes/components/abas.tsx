import Link from "next/link";

import { cn } from "@/components/ui/cn";
import { type Contexto } from "@/lib/auth/contexto";
import { type Permissao } from "@/lib/permissions/matriz";

import { ABAS, type Aba } from "../schemas";

export const ROTULO_ABA: Record<Aba, string> = {
  resumo: "Resumo",
  itens: "Itens",
  recebimentos: "Recebimentos",
  bens: "Bens e lotes",
  movimentacoes: "Movimentações",
  evidencias: "Documentos",
  devolucoes: "Devoluções",
  cobrancas: "Cobranças",
  historico: "Histórico",
};

/** Permissão para ver cada aba (a RLS também filtra os dados). */
const PERMISSAO_ABA: Partial<Record<Aba, Permissao>> = {
  itens: "valores.ver",
  recebimentos: "dados.ler_geral",
  bens: "valores.ver",
  movimentacoes: "valores.ver",
  evidencias: "dados.ler_geral",
  devolucoes: "dados.ler_geral",
  cobrancas: "valores.ver",
  historico: "auditoria.ler",
};

export function abasVisiveis(contexto: Contexto): Aba[] {
  return ABAS.filter((a) => {
    const p = PERMISSAO_ABA[a];
    return !p || contexto.permissoes.includes(p);
  });
}

/** Abas como links (?aba=): cada aba é uma URL compartilhável e funciona sem JS. */
export function AbasLocacao({
  locacaoId,
  atual,
  visiveis,
}: {
  locacaoId: string;
  atual: Aba;
  visiveis: Aba[];
}) {
  return (
    <nav
      aria-label="Seções da locação"
      className="-mx-4 overflow-x-auto border-b border-borda px-4 sm:mx-0 sm:px-0"
    >
      <ul className="flex min-w-max gap-1 lg:min-w-0 lg:flex-wrap">
        {visiveis.map((aba) => (
          <li key={aba}>
            <Link
              id={`aba-${aba}`}
              href={`/locacoes/${locacaoId}?aba=${aba}`}
              aria-current={aba === atual ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center border-b-2 px-3 font-medium",
                aba === atual
                  ? "border-primaria text-primaria"
                  : "border-transparent text-texto-suave hover:text-texto",
              )}
            >
              {ROTULO_ABA[aba]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
