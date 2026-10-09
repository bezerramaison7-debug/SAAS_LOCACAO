"use client";

import { useActionState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { ESTADO_INICIAL } from "@/lib/actions/estado";

import { atualizarPerfil } from "../actions";

export function FormPerfil({
  nome,
  telefone,
  email,
}: {
  nome: string;
  telefone: string;
  email: string;
}) {
  const [estado, acao] = useActionState(atualizarPerfil, ESTADO_INICIAL);
  return (
    <form action={acao} className="space-y-4" noValidate>
      <FormAlert estado={estado} />
      <p className="text-texto-suave">
        E-mail de acesso: <strong className="text-texto">{email}</strong>
      </p>
      <FormField nome="nome" rotulo="Nome" erro={estado.errosCampo?.nome} obrigatorio>
        {(a) => <Input {...a} autoComplete="name" defaultValue={estado.valores?.nome ?? nome} />}
      </FormField>
      <FormField nome="telefone" rotulo="Telefone" erro={estado.errosCampo?.telefone}>
        {(a) => (
          <Input
            {...a}
            type="tel"
            autoComplete="tel"
            defaultValue={estado.valores?.telefone ?? telefone}
          />
        )}
      </FormField>
      <SubmitButton pendente="Salvando…">Salvar perfil</SubmitButton>
    </form>
  );
}
