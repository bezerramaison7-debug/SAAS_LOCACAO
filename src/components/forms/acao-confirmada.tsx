"use client";

import { useId, useState, type ReactNode } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Label, Textarea } from "@/components/ui/input";
import { type EstadoAcao, ESTADO_INICIAL } from "@/lib/actions/estado";

import { FormAlert } from "./form-alert";

type Props = {
  /** Server Action; pode redirecionar em caso de sucesso. */
  acao: (dados: FormData) => Promise<EstadoAcao>;
  /** Campos enviados junto (ex.: id). A empresa NUNCA vai aqui: vem da sessão. */
  campos: Record<string, string>;
  rotulo: ReactNode;
  titulo: string;
  descricao: ReactNode;
  rotuloConfirmar: string;
  perigoso?: boolean;
  variante?: ButtonProps["variante"];
  /** Exige justificativa (mín. 10 caracteres) enviada no campo `motivo`. */
  motivo?: { rotulo: string };
};

const MOTIVO_MINIMO = 10;

/** Botão que executa uma ação crítica somente após confirmação explícita. */
export function AcaoConfirmada({
  acao,
  campos,
  rotulo,
  titulo,
  descricao,
  rotuloConfirmar,
  perigoso = false,
  variante,
  motivo,
}: Props) {
  const [estado, setEstado] = useState<EstadoAcao>(ESTADO_INICIAL);
  const [textoMotivo, setTextoMotivo] = useState("");
  const idMotivo = useId();

  async function confirmar() {
    const dados = new FormData();
    for (const [nome, valor] of Object.entries(campos)) dados.set(nome, valor);
    if (motivo) dados.set("motivo", textoMotivo);
    setEstado(await acao(dados));
  }

  return (
    <div className="flex flex-col gap-2">
      <ConfirmDialog
        gatilho={
          <Button variante={variante ?? (perigoso ? "perigo" : "primaria")}>{rotulo}</Button>
        }
        titulo={titulo}
        descricao={descricao}
        rotuloConfirmar={rotuloConfirmar}
        perigoso={perigoso}
        onConfirmar={confirmar}
        confirmarDesabilitado={motivo ? textoMotivo.trim().length < MOTIVO_MINIMO : false}
      >
        {motivo ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={idMotivo}>{motivo.rotulo}</Label>
            <Textarea
              id={idMotivo}
              value={textoMotivo}
              onChange={(e) => setTextoMotivo(e.target.value)}
              maxLength={2000}
              aria-describedby={`${idMotivo}-ajuda`}
            />
            <p id={`${idMotivo}-ajuda`} className="text-sm text-texto-suave">
              Mínimo de {MOTIVO_MINIMO} caracteres. Fica registrado na auditoria.
            </p>
          </div>
        ) : null}
      </ConfirmDialog>
      <FormAlert estado={estado} />
    </div>
  );
}
