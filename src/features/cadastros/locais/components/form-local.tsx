"use client";

import { useActionState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { ESTADO_INICIAL } from "@/lib/actions/estado";

import { CampoAreaTexto, CampoCheckbox, CampoSelecao, CampoTexto } from "../../components/campos";
import { salvarLocal } from "../actions";
import { type Local } from "../queries";
import { ROTULO_TIPO_LOCAL, TIPOS_LOCAL } from "../schemas";

const OPCOES_TIPO = TIPOS_LOCAL.map((t) => ({ valor: t, rotulo: ROTULO_TIPO_LOCAL[t] }));

export function FormLocal({ local }: { local?: Local }) {
  const [estado, acao] = useActionState(salvarLocal, ESTADO_INICIAL);
  return (
    <form action={acao} className="max-w-3xl space-y-4" noValidate>
      <FormAlert estado={estado} />
      {local ? <input type="hidden" name="id" value={local.id} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {local ? (
          <div className="flex flex-col gap-1.5">
            <span className="font-medium">Código</span>
            <span className="flex min-h-11 items-center font-mono">{local.codigo}</span>
          </div>
        ) : (
          <CampoTexto
            estado={estado}
            nome="codigo"
            rotulo="Código"
            obrigatorio
            descricao="Identificador curto e único (ex.: OBRA-01). Não pode ser alterado depois."
          />
        )}
        <CampoTexto estado={estado} nome="nome" rotulo="Nome" inicial={local?.nome} obrigatorio />
        <CampoSelecao
          estado={estado}
          nome="tipo"
          rotulo="Tipo"
          inicial={local?.tipo ?? "OBRA"}
          opcoes={OPCOES_TIPO}
          obrigatorio
        />
      </div>
      <CampoAreaTexto estado={estado} nome="endereco" rotulo="Endereço" inicial={local?.endereco} />
      <CampoCheckbox
        estado={estado}
        nome="ativo"
        rotulo="Ativo"
        inicial={local?.ativo ?? true}
        descricao="Local inativo não recebe novos bens nem movimentações. Nada é excluído."
      />
      <SubmitButton pendente="Salvando…">
        {local ? "Salvar alterações" : "Cadastrar local"}
      </SubmitButton>
    </form>
  );
}
