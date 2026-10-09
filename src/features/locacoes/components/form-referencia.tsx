"use client";

import { useActionState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { CampoSelecao, CampoTexto } from "@/features/cadastros/components/campos";
import { ESTADO_INICIAL } from "@/lib/actions/estado";

import { adicionarReferencia } from "../actions";
import {
  ROTULO_SISTEMA,
  ROTULO_TIPO_REFERENCIA,
  SISTEMAS_EXTERNOS,
  TIPOS_REFERENCIA,
} from "../rotulos";

const SISTEMAS = SISTEMAS_EXTERNOS.map((s) => ({ valor: s, rotulo: ROTULO_SISTEMA[s] }));
const TIPOS = TIPOS_REFERENCIA.map((t) => ({ valor: t, rotulo: ROTULO_TIPO_REFERENCIA[t] }));

/** Vínculo MANUAL com documentos do Sectra (não há integração automática — D-41). */
export function FormReferencia({
  locacaoId,
  retorno,
}: {
  locacaoId: string;
  retorno: "editar" | "detalhe";
}) {
  const [estado, acao] = useActionState(adicionarReferencia, ESTADO_INICIAL);
  return (
    <form
      action={acao}
      className="space-y-4 rounded-md border border-borda bg-superficie p-4"
      noValidate
    >
      <h3 className="text-lg font-semibold">Vincular documento</h3>
      <FormAlert estado={estado} />
      <input type="hidden" name="locacaoId" value={locacaoId} />
      <input type="hidden" name="retorno" value={retorno} />
      <div className="grid gap-4 md:grid-cols-2">
        <CampoSelecao
          estado={estado}
          nome="sistema"
          rotulo="Sistema"
          inicial="SECTRA"
          opcoes={SISTEMAS}
          obrigatorio
        />
        <CampoSelecao
          estado={estado}
          nome="tipo"
          rotulo="Tipo de documento"
          inicial="PEDIDO"
          opcoes={TIPOS}
          obrigatorio
        />
        <CampoTexto
          estado={estado}
          nome="numero"
          rotulo="Número do documento"
          obrigatorio
          autoComplete="off"
        />
        <CampoTexto estado={estado} nome="dataDocumento" rotulo="Data do documento" tipo="date" />
      </div>
      <CampoTexto estado={estado} nome="observacao" rotulo="Observação" />
      <SubmitButton pendente="Vinculando…">Vincular documento</SubmitButton>
    </form>
  );
}
