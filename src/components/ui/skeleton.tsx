import { type ComponentProps } from "react";

import { cn } from "./cn";

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-md bg-superficie-2", className)}
      {...props}
    />
  );
}

/** Esqueleto padrão de página de listagem (cabeçalho + linhas). */
export function SkeletonLista({ linhas = 6 }: { linhas?: number }) {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">Carregando…</span>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-11 w-full" />
      {Array.from({ length: linhas }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}
