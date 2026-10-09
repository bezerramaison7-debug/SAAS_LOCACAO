"use client";

import { useActionState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { CampoTexto } from "@/features/cadastros/components/campos";
import { ESTADO_INICIAL } from "@/lib/actions/estado";

import { agendarDevolucao } from "../actions";

export function FormAgendamento({
  id,
  inicial,
  reagendar,
}: {
  id: string;
  inicial: string;
  reagendar: boolean;
}) {
  const [estado, acao] = useActionState(agendarDevolucao, ESTADO_INICIAL);
  return (
    <form action={acao} className="space-y-3" noValidate>
      <FormAlert estado={estado} />
      <input type="hidden" name="id" value={id} />
      <CampoTexto
        estado={estado}
        nome="agendadaPara"
        rotulo={reagendar ? "Nova data da retirada" : "Data combinada para a retirada"}
        tipo="datetime-local"
        inicial={inicial}
        obrigatorio
        {...(reagendar ? { descricao: "A data anterior fica registrada no histórico." } : {})}
      />
      <SubmitButton pendente="Salvando…" variante="secundaria">
        {reagendar ? "Reagendar" : "Agendar retirada"}
      </SubmitButton>
    </form>
  );
}
