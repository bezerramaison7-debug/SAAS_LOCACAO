"use client";

import { Dialog } from "radix-ui";
import { useActionState, useState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { ESTADO_INICIAL, type EstadoAcao } from "@/lib/actions/estado";
import { PAPEIS, ROTULO_PAPEL, type Papel } from "@/lib/permissions/matriz";

import { alterarPapel, definirUsuarioAtivo } from "../actions";

type Props = {
  associacaoId: string;
  nome: string;
  papel: Papel;
  ativo: boolean;
  /** O próprio usuário logado (não pode se desativar). */
  proprio: boolean;
};

export function FormPapel({
  associacaoId,
  nome,
  papel,
}: Pick<Props, "associacaoId" | "nome" | "papel">) {
  const [estado, acao] = useActionState(alterarPapel, ESTADO_INICIAL);
  return (
    <form action={acao} className="flex min-w-0 flex-col gap-2" noValidate>
      <input type="hidden" name="associacaoId" value={associacaoId} />
      <div className="flex min-w-0 flex-wrap gap-2">
        <label className="sr-only" htmlFor={`papel-${associacaoId}`}>
          Papel de {nome}
        </label>
        <Select
          id={`papel-${associacaoId}`}
          name="papel"
          defaultValue={papel}
          className="w-auto min-w-0 flex-1 basis-40"
        >
          {PAPEIS.map((p) => (
            <option key={p} value={p}>
              {ROTULO_PAPEL[p]}
            </option>
          ))}
        </Select>
        <SubmitButton variante="secundaria" pendente="…" aria-label={`Salvar papel de ${nome}`}>
          Salvar
        </SubmitButton>
      </div>
      <FormAlert estado={estado} />
    </form>
  );
}

/** Desativar/reativar exige confirmação e motivo (auditado). */
export function BotaoAtivo({ associacaoId, nome, ativo, proprio }: Omit<Props, "papel">) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao] = useActionState(async (anterior: EstadoAcao, dados: FormData) => {
    const resultado = await definirUsuarioAtivo(anterior, dados);
    if (resultado.status === "sucesso") setAberto(false);
    return resultado;
  }, ESTADO_INICIAL);
  if (proprio) return <span className="text-sm text-texto-suave">Você</span>;
  const rotulo = ativo ? "Desativar" : "Reativar";
  return (
    <>
      {estado.status === "sucesso" ? <FormAlert estado={estado} /> : null}
      <Dialog.Root open={aberto} onOpenChange={setAberto}>
        <Dialog.Trigger asChild>
          <Button variante={ativo ? "secundaria" : "primaria"} aria-label={`${rotulo} ${nome}`}>
            {rotulo}
          </Button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-borda bg-superficie p-6 shadow-sutil">
            <Dialog.Title className="mb-2 text-lg font-semibold">
              {rotulo} acesso de {nome}
            </Dialog.Title>
            <Dialog.Description className="mb-4 text-texto-suave">
              {ativo
                ? "O usuário perde imediatamente o acesso aos dados desta empresa. O histórico é preservado."
                : "O usuário volta a acessar os dados desta empresa com o papel atual."}
            </Dialog.Description>
            <form action={acao} className="space-y-4" noValidate>
              <FormAlert estado={estado.status === "erro" ? estado : ESTADO_INICIAL} />
              <input type="hidden" name="associacaoId" value={associacaoId} />
              <input type="hidden" name="ativo" value={ativo ? "false" : "true"} />
              <FormField nome="motivo" rotulo="Motivo" erro={estado.errosCampo?.motivo} obrigatorio>
                {(a) => <Textarea {...a} minLength={10} />}
              </FormField>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Dialog.Close asChild>
                  <Button variante="secundaria">Cancelar</Button>
                </Dialog.Close>
                <SubmitButton variante={ativo ? "perigo" : "primaria"} pendente="Salvando…">
                  Confirmar
                </SubmitButton>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
