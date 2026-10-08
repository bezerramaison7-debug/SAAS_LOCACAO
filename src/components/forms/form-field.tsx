import { type ReactNode, useId } from "react";

import { Label } from "@/components/ui/input";

/** Atributos de acessibilidade que o campo deve receber. */
export type AtributosCampo = {
  id: string;
  name: string;
  required?: boolean;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
};

type FormFieldProps = {
  nome: string;
  rotulo: string;
  descricao?: string;
  /** Mensagem de erro do servidor para este campo (exibida junto ao campo). */
  erro?: string | undefined;
  obrigatorio?: boolean;
  children: (atributos: AtributosCampo) => ReactNode;
};

/**
 * Rótulo visível + descrição + erro contextual, ligados ao campo por
 * `htmlFor`/`aria-describedby`/`aria-invalid`.
 */
export function FormField({
  nome,
  rotulo,
  descricao,
  erro,
  obrigatorio = false,
  children,
}: FormFieldProps) {
  const id = `${nome}-${useId()}`;
  const idDescricao = descricao ? `${id}-descricao` : undefined;
  const idErro = erro ? `${id}-erro` : undefined;
  const descritoPor = [idDescricao, idErro].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {rotulo}
        {obrigatorio ? (
          <span className="text-perigo" aria-hidden>
            {" "}
            *
          </span>
        ) : null}
      </Label>
      {children({
        id,
        name: nome,
        ...(obrigatorio ? { required: true } : {}),
        ...(erro ? { "aria-invalid": true as const } : {}),
        ...(descritoPor ? { "aria-describedby": descritoPor } : {}),
      })}
      {descricao ? (
        <p id={idDescricao} className="text-sm text-texto-suave">
          {descricao}
        </p>
      ) : null}
      {erro ? (
        <p id={idErro} className="text-sm font-medium text-perigo">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
