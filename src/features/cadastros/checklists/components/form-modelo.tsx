"use client";

import { useActionState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { ESTADO_INICIAL } from "@/lib/actions/estado";

import { CampoAreaTexto, CampoTexto } from "../../components/campos";
import { salvarModeloChecklist } from "../actions";
import { type ModeloChecklist } from "../queries";

export function FormModelo({ modelo }: { modelo?: ModeloChecklist }) {
  const [estado, acao] = useActionState(salvarModeloChecklist, ESTADO_INICIAL);
  return (
    <form action={acao} className="max-w-3xl space-y-4" noValidate>
      <FormAlert estado={estado} />
      {modelo ? <input type="hidden" name="id" value={modelo.id} /> : null}
      <CampoTexto
        estado={estado}
        nome="nome"
        rotulo="Nome do checklist"
        inicial={modelo?.nome}
        obrigatorio
      />
      <CampoAreaTexto
        estado={estado}
        nome="descricao"
        rotulo="Descrição"
        inicial={modelo?.descricao}
      />
      <SubmitButton pendente="Salvando…">
        {modelo ? "Salvar nome e descrição" : "Criar rascunho"}
      </SubmitButton>
    </form>
  );
}
