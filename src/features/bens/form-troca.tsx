"use client";

import { useActionState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { CampoAreaTexto, CampoTexto } from "@/features/cadastros/components/campos";
import { ESTADO_INICIAL } from "@/lib/actions/estado";

import { trocarBem } from "./actions";

export function FormTroca({
  bemId,
  agoraLocal,
  exige,
  atual,
}: {
  bemId: string;
  agoraLocal: string;
  exige: { numeroSerie: boolean; placa: boolean; identificacaoFornecedor: boolean };
  atual: { numeroSerie: string | null; placa: string | null };
}) {
  const [estado, acao] = useActionState(trocarBem, ESTADO_INICIAL);
  return (
    <form action={acao} className="max-w-3xl space-y-4" noValidate>
      <FormAlert estado={estado} />
      <input type="hidden" name="bemId" value={bemId} />
      <p className="text-texto-suave">
        Bem atual: série {atual.numeroSerie ?? "—"}
        {atual.placa ? ` · placa ${atual.placa}` : ""}. A identificação do novo bem deve ser
        diferente — o histórico do antigo é preservado.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <CampoTexto
          estado={estado}
          nome="dataEvento"
          rotulo="Data e hora da troca"
          tipo="datetime-local"
          inicial={agoraLocal}
          obrigatorio
        />
        <CampoTexto
          estado={estado}
          nome="numeroSerie"
          rotulo="Número de série do novo bem"
          obrigatorio={exige.numeroSerie}
          autoComplete="off"
        />
        {exige.placa ? (
          <CampoTexto
            estado={estado}
            nome="placa"
            rotulo="Placa do novo bem"
            obrigatorio
            autoComplete="off"
          />
        ) : null}
        {exige.identificacaoFornecedor ? (
          <CampoTexto
            estado={estado}
            nome="identificacaoFornecedor"
            rotulo="Patrimônio do fornecedor"
            obrigatorio
            autoComplete="off"
          />
        ) : null}
      </div>
      <CampoAreaTexto estado={estado} nome="motivo" rotulo="Motivo da troca" obrigatorio />
      <SubmitButton pendente="Registrando…">Registrar troca</SubmitButton>
    </form>
  );
}
