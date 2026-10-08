import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

import { cn } from "./cn";

type EmptyStateProps = {
  icone: LucideIcon;
  titulo: string;
  descricao: ReactNode;
  /** Ação sugerida (ex.: botão "Nova locação"). */
  acao?: ReactNode;
  className?: string;
};

/** Estado vazio com explicação e, quando houver, a próxima ação. */
export function EmptyState({ icone: Icone, titulo, descricao, acao, className }: EmptyStateProps) {
  return (
    <section
      className={cn(
        "flex flex-col items-center gap-3 rounded-md border border-dashed border-borda-forte bg-superficie px-6 py-10 text-center",
        className,
      )}
    >
      <Icone aria-hidden className="size-10 text-texto-suave" />
      <h2 className="text-lg font-semibold">{titulo}</h2>
      <div className="max-w-prose text-texto-suave">{descricao}</div>
      {acao ? <div className="mt-2">{acao}</div> : null}
    </section>
  );
}
