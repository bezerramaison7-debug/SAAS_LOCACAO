"use client";

import { useFormStatus } from "react-dom";

import { Button, type ButtonProps } from "@/components/ui/button";

/** Botão de envio que se desabilita enquanto a Server Action executa. */
export function SubmitButton({
  children,
  pendente = "Enviando…",
  ...props
}: ButtonProps & { pendente?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variante="primaria" disabled={pending} aria-busy={pending} {...props}>
      {pending ? pendente : children}
    </Button>
  );
}
