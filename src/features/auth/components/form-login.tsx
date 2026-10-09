"use client";

import Link from "next/link";
import { useActionState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { ESTADO_INICIAL } from "@/lib/actions/estado";

import { entrar } from "../actions";

export function FormLogin({ next }: { next?: string | undefined }) {
  const [estado, acao] = useActionState(entrar, ESTADO_INICIAL);
  return (
    <form action={acao} className="space-y-4" noValidate>
      <FormAlert estado={estado} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormField nome="email" rotulo="E-mail" erro={estado.errosCampo?.email} obrigatorio>
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
      <FormField nome="senha" rotulo="Senha" erro={estado.errosCampo?.senha} obrigatorio>
        {(attrs) => <Input {...attrs} type="password" autoComplete="current-password" />}
      </FormField>
      <SubmitButton className="w-full" pendente="Entrando…">
        Entrar
      </SubmitButton>
      <p className="text-center">
        <Link href="/recuperar-senha" className="text-primaria underline-offset-4 hover:underline">
          Esqueci minha senha
        </Link>
      </p>
    </form>
  );
}
