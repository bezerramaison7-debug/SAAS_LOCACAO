"use client";

import { type ReactNode, useActionState } from "react";

import { type ButtonProps } from "@/components/ui/button";
import { type EstadoAcao, ESTADO_INICIAL } from "@/lib/actions/estado";

import { FormAlert } from "./form-alert";
import { SubmitButton } from "./submit-button";

/** Botão que dispara uma Server Action não destrutiva (sem diálogo), com erro visível. */
export function AcaoSimples({
  acao,
  campos,
  rotulo,
  pendente = "Aguarde…",
  variante,
}: {
  acao: (dados: FormData) => Promise<EstadoAcao>;
  campos: Record<string, string>;
  rotulo: ReactNode;
  pendente?: string;
  variante?: ButtonProps["variante"];
}) {
  const [estado, executar] = useActionState(
    (_: EstadoAcao, dados: FormData) => acao(dados),
    ESTADO_INICIAL,
  );
  return (
    <form action={executar} className="flex flex-col gap-2">
      {Object.entries(campos).map(([nome, valor]) => (
        <input key={nome} type="hidden" name={nome} value={valor} />
      ))}
      <SubmitButton pendente={pendente} {...(variante ? { variante } : {})}>
        {rotulo}
      </SubmitButton>
      <FormAlert estado={estado} />
    </form>
  );
}
