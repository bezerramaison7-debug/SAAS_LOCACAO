"use client";

import { useActionState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { CampoAreaTexto } from "@/features/cadastros/components/campos";
import { Input } from "@/components/ui/input";
import { ESTADO_INICIAL } from "@/lib/actions/estado";
import { formatarQuantidade } from "@/lib/format/moeda";

import { solicitarDevolucao } from "../actions";

type Bem = {
  id: string;
  codigo: string;
  identificacao: string | null;
  descricao: string;
  local: string | null;
};
type Lote = {
  id: string;
  codigo: string;
  descricao: string;
  unidade: string;
  local: string | null;
  disponivel: string;
};

/** RN-52: bens marcados ficam "devolução solicitada"; quantidades de lote ficam reservadas. */
export function FormSolicitacao({
  locacaoId,
  bens,
  lotes,
}: {
  locacaoId: string;
  bens: Bem[];
  lotes: Lote[];
}) {
  const [estado, acao] = useActionState(solicitarDevolucao, ESTADO_INICIAL);
  const v = estado.valores ?? {};
  return (
    <form action={acao} className="max-w-3xl space-y-6" noValidate>
      <FormAlert estado={estado} />
      <input type="hidden" name="locacaoId" value={locacaoId} />
      {bens.length ? (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-lg font-semibold">Bens individuais</legend>
          {bens.map((b) => (
            <label
              key={b.id}
              className="flex min-h-11 items-start gap-3 rounded-md border border-borda bg-superficie p-3"
            >
              <input
                type="checkbox"
                name={`bem_${b.id}`}
                defaultChecked={v[`bem_${b.id}`] === "on"}
                className="mt-0.5 size-5 shrink-0 accent-[var(--primaria)]"
              />
              <span className="min-w-0">
                <span className="font-mono font-medium">{b.codigo}</span>
                {b.identificacao ? ` · ${b.identificacao}` : ""}
                <span className="block text-sm text-texto-suave">
                  {b.descricao}
                  {b.local ? ` · ${b.local}` : ""}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}
      {lotes.length ? (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-lg font-semibold">Lotes (quantidade a devolver)</legend>
          {lotes.map((l) => {
            const nome = `lote_${l.id}`;
            const erro = estado.errosCampo?.[nome];
            return (
              <div
                key={l.id}
                className="space-y-1.5 rounded-md border border-borda bg-superficie p-3"
              >
                <label htmlFor={`campo-${l.id}`} className="block">
                  <span className="font-mono font-medium">{l.codigo}</span> · {l.descricao}
                  <span className="block text-sm text-texto-suave">
                    Disponível para devolução: {formatarQuantidade(l.disponivel)} {l.unidade}
                    {l.local ? ` · ${l.local}` : ""}
                  </span>
                </label>
                <Input
                  id={`campo-${l.id}`}
                  name={nome}
                  inputMode="decimal"
                  placeholder="Vazio = não devolver"
                  defaultValue={v[nome] ?? ""}
                  className="sm:max-w-48"
                  {...(erro ? { "aria-invalid": true, "aria-describedby": `erro-${l.id}` } : {})}
                />
                {erro ? (
                  <p id={`erro-${l.id}`} className="text-sm text-perigo">
                    {erro}
                  </p>
                ) : null}
              </div>
            );
          })}
        </fieldset>
      ) : null}
      <CampoAreaTexto estado={estado} nome="observacoes" rotulo="Observações" />
      <p className="text-sm text-texto-suave">
        O saldo da locação só muda quando a retirada for confirmada.
      </p>
      <SubmitButton pendente="Solicitando…">Solicitar devolução</SubmitButton>
    </form>
  );
}
