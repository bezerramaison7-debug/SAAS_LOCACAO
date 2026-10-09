import { type ReactNode } from "react";

import { cn } from "@/components/ui/cn";

export type Coluna<T> = {
  chave: string;
  titulo: string;
  render: (linha: T) => ReactNode;
  /** Coluna principal: título do cartão no celular. */
  principal?: boolean;
  alinhamento?: "esquerda" | "direita";
};

type DataTableProps<T> = {
  legenda: string;
  colunas: readonly Coluna<T>[];
  linhas: readonly T[];
  chaveLinha: (linha: T) => string;
  vazio: ReactNode;
};

/**
 * Tabela no desktop/tablet (≥ 768px) e lista de cartões no celular,
 * sem rolagem horizontal da página.
 */
export function DataTable<T>({ legenda, colunas, linhas, chaveLinha, vazio }: DataTableProps<T>) {
  if (linhas.length === 0) return <>{vazio}</>;
  const principal = colunas.find((c) => c.principal) ?? colunas[0];
  const secundarias = colunas.filter((c) => c !== principal);

  return (
    <>
      {/* Região rolável focável: a tabela pode ser mais larga que a tela (WCAG 2.1.1). */}
      <div
        role="region"
        aria-label={legenda}
        tabIndex={0}
        className="hidden overflow-x-auto rounded-md border border-borda bg-superficie md:block"
      >
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{legenda}</caption>
          <thead className="bg-superficie-2 text-sm text-texto-suave">
            <tr>
              {colunas.map((coluna) => (
                <th
                  key={coluna.chave}
                  scope="col"
                  className={cn(
                    "px-4 py-3 font-medium",
                    coluna.alinhamento === "direita" && "text-right",
                  )}
                >
                  {coluna.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => (
              <tr key={chaveLinha(linha)} className="border-t border-borda">
                {colunas.map((coluna) => (
                  <td
                    key={coluna.chave}
                    className={cn("px-4 py-3", coluna.alinhamento === "direita" && "text-right")}
                  >
                    {coluna.render(linha)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden" aria-label={legenda}>
        {linhas.map((linha) => (
          <li key={chaveLinha(linha)} className="rounded-md border border-borda bg-superficie p-4">
            {principal ? <div className="mb-2 font-semibold">{principal.render(linha)}</div> : null}
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              {secundarias.map((coluna) => (
                <div key={coluna.chave} className="contents">
                  <dt className="text-texto-suave">{coluna.titulo}</dt>
                  <dd className="min-w-0 break-words">{coluna.render(linha)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
