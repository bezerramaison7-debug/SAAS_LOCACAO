"use client";

import { useActionState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { CampoAreaTexto, CampoSelecao, CampoTexto } from "@/features/cadastros/components/campos";
import { ESTADO_INICIAL } from "@/lib/actions/estado";

import { registrarCobranca } from "../actions";

export function FormCobranca({
  locacoes,
  locacaoInicial,
}: {
  locacoes: { id: string; rotulo: string }[];
  locacaoInicial: string | null;
}) {
  const [estado, acao] = useActionState(registrarCobranca, ESTADO_INICIAL);
  return (
    <form action={acao} className="max-w-3xl space-y-4" noValidate>
      <FormAlert estado={estado} />
      <CampoSelecao
        estado={estado}
        nome="locacaoId"
        rotulo="Locação"
        inicial={locacaoInicial}
        vazio="Selecione…"
        opcoes={locacoes.map((l) => ({ valor: l.id, rotulo: l.rotulo }))}
        obrigatorio
      />
      <div className="grid gap-4 md:grid-cols-2">
        <CampoTexto
          estado={estado}
          nome="competenciaInicio"
          rotulo="Competência — início"
          tipo="date"
          obrigatorio
        />
        <CampoTexto
          estado={estado}
          nome="competenciaFim"
          rotulo="Competência — fim"
          tipo="date"
          obrigatorio
        />
        <CampoTexto
          estado={estado}
          nome="valor"
          rotulo="Valor cobrado (R$)"
          inputMode="decimal"
          obrigatorio
          descricao="Como consta no documento do fornecedor. Ex.: 5.672,00"
        />
        <CampoTexto estado={estado} nome="numeroDocumento" rotulo="Número do documento" />
      </div>
      <CampoAreaTexto estado={estado} nome="observacoes" rotulo="Observações" />
      <SubmitButton pendente="Registrando…">Registrar cobrança</SubmitButton>
    </form>
  );
}
