"use client";

import { useActionState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input, Select } from "@/components/ui/input";
import { ESTADO_INICIAL } from "@/lib/actions/estado";

import { atualizarEmpresa } from "../actions";
import { type ConfiguracaoEmpresa } from "../queries";
import { FUSOS_BRASIL } from "../schemas";

export function FormEmpresa({ atual }: { atual: ConfiguracaoEmpresa }) {
  const [estado, acao] = useActionState(atualizarEmpresa, ESTADO_INICIAL);
  return (
    <form action={acao} className="space-y-4" noValidate>
      <FormAlert estado={estado} />
      <FormField nome="nome" rotulo="Nome da empresa" erro={estado.errosCampo?.nome} obrigatorio>
        {(a) => <Input {...a} defaultValue={estado.valores?.nome ?? atual.nome} />}
      </FormField>
      <FormField
        nome="timezone"
        rotulo="Fuso horário"
        descricao="Datas e horas são exibidas neste fuso; o banco grava sempre em UTC."
        erro={estado.errosCampo?.timezone}
        obrigatorio
      >
        {(a) => (
          <Select {...a} defaultValue={estado.valores?.timezone ?? atual.timezone}>
            {FUSOS_BRASIL.map((f) => (
              <option key={f} value={f}>
                {f.replace("America/", "").replace("_", " ")}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <FormField
        nome="limiteAtrasoHoras"
        rotulo="Limite para lançamento com atraso (horas)"
        descricao="Registros feitos depois deste prazo recebem o selo “Lançado com atraso”."
        erro={estado.errosCampo?.limiteAtrasoHoras}
        obrigatorio
      >
        {(a) => (
          <Input
            {...a}
            type="number"
            inputMode="numeric"
            min={1}
            max={720}
            defaultValue={estado.valores?.limiteAtrasoHoras ?? String(atual.limiteAtrasoHoras)}
          />
        )}
      </FormField>
      <label className="flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          name="exigeAceite"
          defaultChecked={atual.exigeAceite}
          className="size-5 accent-[var(--primaria)]"
        />
        <span>Exigir aceite do novo responsável nas movimentações</span>
      </label>
      <SubmitButton pendente="Salvando…">Salvar configurações</SubmitButton>
    </form>
  );
}
