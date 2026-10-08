"use client";

import { useActionState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { CampoTexto } from "@/features/cadastros/components/campos";
import { ESTADO_INICIAL } from "@/lib/actions/estado";

import { salvarVigencia } from "../actions";
import { type Locacao } from "../queries";

export function FormVigencia({ locacao }: { locacao: Locacao }) {
  const [estado, acao] = useActionState(salvarVigencia, ESTADO_INICIAL);
  return (
    <form action={acao} className="max-w-xl space-y-4" noValidate>
      <FormAlert estado={estado} />
      <input type="hidden" name="id" value={locacao.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoTexto
          estado={estado}
          nome="inicioPrevisto"
          rotulo="Início previsto"
          tipo="date"
          inicial={locacao.inicioPrevisto}
          obrigatorio
        />
        <CampoTexto
          estado={estado}
          nome="terminoPrevisto"
          rotulo="Término previsto"
          tipo="date"
          inicial={locacao.terminoPrevisto}
          obrigatorio
        />
      </div>
      <p className="text-texto-suave">
        Datas civis da obra (sem horário). O início efetivo é registrado no primeiro recebimento.
      </p>
      <SubmitButton pendente="Salvando…">Salvar e revisar</SubmitButton>
    </form>
  );
}
