"use client";

import { useActionState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { CampoTexto } from "@/features/cadastros/components/campos";
import { ESTADO_INICIAL } from "@/lib/actions/estado";

import { encerrarFinanceiro } from "./actions";

export function FormEncerramentoFinanceiro({ id, hoje }: { id: string; hoje: string }) {
  const [estado, acao] = useActionState(encerrarFinanceiro, ESTADO_INICIAL);
  return (
    <form action={acao} className="space-y-3" noValidate>
      <FormAlert estado={estado} />
      <input type="hidden" name="id" value={id} />
      <CampoTexto
        estado={estado}
        nome="dataEncerramento"
        rotulo="Data de encerramento da cobrança"
        tipo="date"
        inicial={hoje}
        obrigatorio
        descricao="Data em que a cobrança do fornecedor terminou (confirmada pelo financeiro)."
      />
      <SubmitButton pendente="Encerrando…">Confirmar encerramento financeiro</SubmitButton>
    </form>
  );
}
