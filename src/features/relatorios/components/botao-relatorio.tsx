"use client";

import { FileText } from "lucide-react";
import { useActionState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { ESTADO_INICIAL } from "@/lib/actions/estado";

import { solicitarRelatorio } from "../actions";
import { type TipoRelatorio } from "../rotulos";

/** Atalho "Gerar relatório PDF" na ficha/locação: enfileira e abre o acompanhamento. */
export function BotaoRelatorio({ tipo, alvo }: { tipo: TipoRelatorio; alvo: string }) {
  const [estado, acao] = useActionState(solicitarRelatorio, ESTADO_INICIAL);
  return (
    <form action={acao} className="flex flex-col gap-2">
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="alvo" value={alvo} />
      <SubmitButton pendente="Pedindo…" variante="secundaria">
        <FileText aria-hidden /> Gerar relatório PDF
      </SubmitButton>
      <FormAlert estado={estado} />
    </form>
  );
}
