"use client";

import { useActionState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { ESTADO_INICIAL } from "@/lib/actions/estado";

import { CampoCheckbox, CampoTexto } from "../../components/campos";
import { salvarCentroCusto } from "../actions";
import { type CentroCusto } from "../queries";

export function FormCentroCusto({ centro }: { centro?: CentroCusto }) {
  const [estado, acao] = useActionState(salvarCentroCusto, ESTADO_INICIAL);
  return (
    <form action={acao} className="max-w-3xl space-y-4" noValidate>
      <FormAlert estado={estado} />
      {centro ? <input type="hidden" name="id" value={centro.id} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {centro ? (
          <div className="flex flex-col gap-1.5">
            <span className="font-medium">Código</span>
            <span className="flex min-h-11 items-center font-mono">{centro.codigo}</span>
          </div>
        ) : (
          <CampoTexto
            estado={estado}
            nome="codigo"
            rotulo="Código"
            obrigatorio
            descricao="Mesmo código usado no Sectra/ERP. Não pode ser alterado depois."
          />
        )}
        <CampoTexto estado={estado} nome="nome" rotulo="Nome" inicial={centro?.nome} obrigatorio />
      </div>
      <CampoCheckbox
        estado={estado}
        nome="ativo"
        rotulo="Ativo"
        inicial={centro?.ativo ?? true}
        descricao="Centro de custo inativo não pode ser usado em novas locações. Nada é excluído."
      />
      <SubmitButton pendente="Salvando…">
        {centro ? "Salvar alterações" : "Cadastrar centro de custo"}
      </SubmitButton>
    </form>
  );
}
