import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { type ComponentProps } from "react";

import { cn } from "./cn";

export const buttonVariants = cva(
  // min-h-11/min-w-11 = 44px: alvo de toque mínimo.
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md px-4 text-base font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-60 [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variante: {
        primaria: "bg-primaria text-primaria-contraste hover:bg-primaria-hover",
        secundaria: "border border-borda-forte bg-superficie text-texto hover:bg-superficie-2",
        perigo: "bg-perigo text-perigo-contraste hover:opacity-90",
        fantasma: "text-texto hover:bg-superficie-2",
        link: "text-primaria underline-offset-4 hover:underline",
      },
      tamanho: {
        padrao: "",
        icone: "px-0",
      },
    },
    defaultVariants: { variante: "secundaria", tamanho: "padrao" },
  },
);

export type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Renderiza o filho (ex.: <Link>) com o estilo de botão. */
    asChild?: boolean;
  };

export function Button({
  className,
  variante,
  tamanho,
  asChild = false,
  type,
  ...props
}: ButtonProps) {
  const Componente = asChild ? Slot.Root : "button";
  return (
    <Componente
      className={cn(buttonVariants({ variante, tamanho }), className)}
      {...(asChild ? {} : { type: type ?? "button" })}
      {...props}
    />
  );
}
