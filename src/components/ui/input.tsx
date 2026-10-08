import { type ComponentProps } from "react";

import { cn } from "./cn";

export const estiloCampo =
  "min-h-11 w-full rounded-md border border-borda-forte bg-superficie px-3 py-2 text-base text-texto placeholder:text-texto-suave disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-perigo aria-invalid:ring-1 aria-invalid:ring-perigo";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(estiloCampo, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(estiloCampo, "min-h-24", className)} {...props} />;
}

/** Select nativo: acessível e com o seletor do próprio sistema no celular. */
export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(estiloCampo, "pr-8", className)} {...props} />;
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-base font-medium text-texto", className)} {...props} />;
}
