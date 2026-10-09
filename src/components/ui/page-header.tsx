import { type ReactNode } from "react";

type PageHeaderProps = {
  titulo: string;
  descricao?: ReactNode;
  /** A ação primária da tela (no máximo uma). */
  acaoPrimaria?: ReactNode;
};

export function PageHeader({ titulo, descricao, acaoPrimaria }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
        {descricao ? <p className="max-w-prose text-texto-suave">{descricao}</p> : null}
      </div>
      {acaoPrimaria ? <div className="shrink-0">{acaoPrimaria}</div> : null}
    </header>
  );
}
