"use client";

import Link from "next/link";
import { useActionState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { ESTADO_INICIAL } from "@/lib/actions/estado";

import { solicitarRecuperacao } from "../actions";

export function FormRecuperar() {
  const [estado, acao] = useActionState(solicitarRecuperacao, ESTADO_INICIAL);
  return (
    <form action={acao} className="space-y-4" noValidate>
      <FormAlert estado={estado} />
      <FormField
        nome="email"
        rotulo="E-mail"
        descricao="Enviaremos um link para você definir uma nova senha."
        erro={estado.errosCampo?.email}
        obrigatorio
      >
        {(attrs) => (
          <Input
            {...attrs}
            type="email"
            autoComplete="username"
            inputMode="email"
            defaultValue={estado.valores?.email ?? ""}
          />
        )}
      </FormField>
      <SubmitButton className="w-full" pendente="Enviando…">
        Enviar link
      </SubmitButton>
      <p className="text-center">
        <Link href="/login" className="text-primaria underline-offset-4 hover:underline">
          Voltar para o login
        </Link>
      </p>
    </form>
  );
}
