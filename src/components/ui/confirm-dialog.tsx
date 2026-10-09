"use client";

import { AlertDialog } from "radix-ui";
import { type ReactNode, useState, useTransition } from "react";

import { Button } from "./button";

type ConfirmDialogProps = {
  /** Elemento que abre o diálogo (normalmente um <Button>). */
  gatilho: ReactNode;
  titulo: string;
  descricao: ReactNode;
  rotuloConfirmar: string;
  /** Ações irreversíveis usam a variante "perigo". */
  perigoso?: boolean;
  onConfirmar: () => Promise<void> | void;
  /** Conteúdo adicional (ex.: campo de motivo) entre a descrição e os botões. */
  children?: ReactNode;
  /** Desabilita o botão de confirmação (ex.: motivo ainda não preenchido). */
  confirmarDesabilitado?: boolean;
};

/** Confirmação obrigatória para operações críticas ou irreversíveis. */
export function ConfirmDialog({
  gatilho,
  titulo,
  descricao,
  rotuloConfirmar,
  perigoso = false,
  onConfirmar,
  children,
  confirmarDesabilitado = false,
}: ConfirmDialogProps) {
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();

  return (
    <AlertDialog.Root open={aberto} onOpenChange={setAberto}>
      <AlertDialog.Trigger asChild>{gatilho}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-lg border border-borda bg-superficie p-6 shadow-sutil">
          <AlertDialog.Title className="text-lg font-semibold">{titulo}</AlertDialog.Title>
          <AlertDialog.Description asChild>
            <div className="text-texto-suave">{descricao}</div>
          </AlertDialog.Description>
          {children}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button variante="secundaria" disabled={pendente}>
                Cancelar
              </Button>
            </AlertDialog.Cancel>
            <Button
              variante={perigoso ? "perigo" : "primaria"}
              disabled={pendente || confirmarDesabilitado}
              onClick={() =>
                iniciar(async () => {
                  await onConfirmar();
                  setAberto(false);
                })
              }
            >
              {pendente ? "Processando…" : rotuloConfirmar}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
