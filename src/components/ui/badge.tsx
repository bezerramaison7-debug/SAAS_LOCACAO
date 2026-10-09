import { cva, type VariantProps } from "class-variance-authority";
import { type ComponentProps } from "react";

import { cn } from "./cn";

/** Cores semânticas usadas exclusivamente para comunicar estado. */
export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded px-2 py-0.5 text-sm font-medium whitespace-nowrap",
  {
    variants: {
      tom: {
        neutro: "bg-neutro-suave text-texto",
        info: "bg-info-suave text-info",
        sucesso: "bg-sucesso-suave text-sucesso",
        alerta: "bg-alerta-suave text-alerta",
        perigo: "bg-perigo-suave text-perigo",
      },
    },
    defaultVariants: { tom: "neutro" },
  },
);

export type TomEstado = NonNullable<VariantProps<typeof badgeVariants>["tom"]>;

export function Badge({
  className,
  tom,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tom }), className)} {...props} />;
}
