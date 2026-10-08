"use client";

import { useActionState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input, Select } from "@/components/ui/input";
import { ESTADO_INICIAL } from "@/lib/actions/estado";
import { PAPEIS, ROTULO_PAPEL } from "@/lib/permissions/matriz";

import { convidarUsuario } from "../actions";

export function FormConvite() {
  const [estado, acao] = useActionState(convidarUsuario, ESTADO_INICIAL);
  return (
    <form action={acao} className="space-y-4" noValidate aria-label="Convidar usuário">
      <FormAlert estado={estado} />
      <div className="grid gap-4 md:grid-cols-3">
        <FormField nome="nome" rotulo="Nome" erro={estado.errosCampo?.nome} obrigatorio>
          {(a) => (
            <Input
              {...a}
              defaultValue={estado.status === "erro" ? (estado.valores?.nome ?? "") : ""}
            />
          )}
        </FormField>
        <FormField nome="email" rotulo="E-mail" erro={estado.errosCampo?.email} obrigatorio>
          {(a) => (
            <Input
              {...a}
              type="email"
              inputMode="email"
              defaultValue={estado.status === "erro" ? (estado.valores?.email ?? "") : ""}
            />
          )}
        </FormField>
        <FormField nome="papel" rotulo="Papel" erro={estado.errosCampo?.papel} obrigatorio>
          {(a) => (
            <Select {...a} defaultValue={estado.valores?.papel ?? "OPERACAO"}>
              {PAPEIS.map((p) => (
                <option key={p} value={p}>
                  {ROTULO_PAPEL[p]}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      </div>
      <SubmitButton pendente="Enviando convite…">Enviar convite</SubmitButton>
    </form>
  );
}
