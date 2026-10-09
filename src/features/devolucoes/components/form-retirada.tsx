"use client";

import { useActionState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { CampoCheckbox, CampoTexto } from "@/features/cadastros/components/campos";
import { Input, Label, Select } from "@/components/ui/input";
import { CONDICOES, ROTULO_CONDICAO } from "@/features/recebimentos/rotulos";
import { ESTADO_INICIAL } from "@/lib/actions/estado";
import { formatarQuantidade } from "@/lib/format/moeda";

import { confirmarRetirada } from "../actions";

type Item = {
  id: string;
  rotulo: string;
  descricao: string;
  unidade: string;
  solicitada: string;
  lote: boolean;
};

/** RN-53/54: quantidade efetivamente retirada por item (≤ solicitada), condição e recebedor. */
export function FormRetirada({
  id,
  itens,
  agoraLocal,
  imediata,
}: {
  id: string;
  itens: Item[];
  agoraLocal: string;
  imediata: boolean;
}) {
  const [estado, acao] = useActionState(confirmarRetirada, ESTADO_INICIAL);
  const v = estado.valores ?? {};
  return (
    <form action={acao} className="space-y-4" noValidate>
      <FormAlert estado={estado} />
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-4 md:grid-cols-2">
        <CampoTexto
          estado={estado}
          nome="retiradaEm"
          rotulo="Data e hora da retirada"
          tipo="datetime-local"
          inicial={agoraLocal}
          obrigatorio
        />
        <CampoTexto
          estado={estado}
          nome="recebedor"
          rotulo="Quem recebeu pelo fornecedor"
          obrigatorio
          autoComplete="off"
        />
      </div>
      <ul className="space-y-3">
        {itens.map((i) => {
          const qtd = `qtd_${i.id}`;
          const cond = `cond_${i.id}`;
          const erroQtd = estado.errosCampo?.[qtd];
          const erroCond = estado.errosCampo?.[cond];
          return (
            <li key={i.id} className="space-y-2 rounded-md border border-borda bg-superficie p-3">
              <p>
                <span className="font-mono font-medium">{i.rotulo}</span> · {i.descricao}
                <span className="block text-sm text-texto-suave">
                  Solicitado: {formatarQuantidade(i.solicitada)} {i.unidade}
                </span>
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`q-${i.id}`}>
                    Quantidade retirada ({i.lote ? i.unidade : "0 ou 1"})
                  </Label>
                  <Input
                    id={`q-${i.id}`}
                    name={qtd}
                    inputMode="decimal"
                    defaultValue={v[qtd] ?? formatarQuantidade(i.solicitada)}
                    {...(erroQtd ? { "aria-invalid": true, "aria-describedby": `eq-${i.id}` } : {})}
                  />
                  {erroQtd ? (
                    <p id={`eq-${i.id}`} className="text-sm text-perigo">
                      {erroQtd}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`c-${i.id}`}>Condição de saída</Label>
                  <Select
                    id={`c-${i.id}`}
                    name={cond}
                    defaultValue={v[cond] ?? ""}
                    {...(erroCond
                      ? { "aria-invalid": true, "aria-describedby": `ec-${i.id}` }
                      : {})}
                  >
                    <option value="">Selecione…</option>
                    {CONDICOES.map((c) => (
                      <option key={c} value={c}>
                        {ROTULO_CONDICAO[c]}
                      </option>
                    ))}
                  </Select>
                  {erroCond ? (
                    <p id={`ec-${i.id}`} className="text-sm text-perigo">
                      {erroCond}
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {imediata ? (
        <CampoCheckbox
          estado={estado}
          nome="imediata"
          rotulo="Retirada imediata (sem agendamento prévio)"
          inicial={false}
          descricao="Registra o agendamento com a mesma data da retirada, mantendo as duas etapas no histórico."
        />
      ) : null}
      <p className="text-sm text-texto-suave">
        Itens com quantidade 0 voltam à situação anterior. A retirada não encerra a cobrança: o
        financeiro confirma o encerramento separadamente.
      </p>
      <SubmitButton pendente="Confirmando…">Confirmar retirada</SubmitButton>
    </form>
  );
}
