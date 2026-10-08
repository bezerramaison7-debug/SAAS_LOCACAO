"use client";

import { useActionState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { ESTADO_INICIAL } from "@/lib/actions/estado";

import { redefinirSenha } from "../actions";

export function FormRedefinir() {
  const [estado, acao] = useActionState(redefinirSenha, ESTADO_INICIAL);
  return (
    <form action={acao} className="space-y-4" noValidate>
      <FormAlert estado={estado} />
      <FormField
        nome="senha"
        rotulo="Nova senha"
        descricao="Mínimo de 10 caracteres, com maiúsculas, minúsculas e números."
        erro={estado.errosCampo?.senha}
        obrigatorio
      >
        {(attrs) => <Input {...attrs} type="password" autoComplete="new-password" />}
      </FormField>
      <FormField
        nome="confirmacao"
        rotulo="Confirme a nova senha"
        erro={estado.errosCampo?.confirmacao}
        obrigatorio
      >
        {(attrs) => <Input {...attrs} type="password" autoComplete="new-password" />}
      </FormField>
      <SubmitButton className="w-full" pendente="Salvando…">
        Salvar senha e entrar
      </SubmitButton>
    </form>
  );
}
