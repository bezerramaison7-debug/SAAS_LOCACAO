"use client";

import { type ReactNode, useActionState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { ESTADO_INICIAL } from "@/lib/actions/estado";

import { salvarRespostas } from "../actions";

export type PerguntaVistoria = {
  id: string;
  ordem: number;
  texto: string;
  tipoResposta: "SIM_NAO" | "CONFORME_NAO_CONFORME" | "OPCAO_UNICA" | "TEXTO" | "NUMERO";
  opcoes: string[] | null;
  obrigatoria: boolean;
  regraFoto: string;
};

const FIXAS: Record<string, [string, string][]> = {
  SIM_NAO: [
    ["SIM", "Sim"],
    ["NAO", "Não"],
  ],
  CONFORME_NAO_CONFORME: [
    ["CONFORME", "Conforme"],
    ["NAO_CONFORME", "Não conforme"],
  ],
};

/**
 * Respostas do checklist. Fotos por pergunta são enviadas na hora (slot
 * `fotos`), independentes do botão de salvar respostas.
 */
export function FormVistoria({
  vistoriaId,
  recebimentoId,
  perguntas,
  respostas,
  fotos,
}: {
  vistoriaId: string;
  recebimentoId: string;
  perguntas: PerguntaVistoria[];
  respostas: Record<string, string>;
  fotos: Record<string, ReactNode>;
}) {
  const [estado, acao] = useActionState(salvarRespostas, ESTADO_INICIAL);
  const valor = (id: string) => estado.valores?.[`resposta_${id}`] ?? respostas[id] ?? "";
  return (
    <form action={acao} className="space-y-4" noValidate>
      <FormAlert estado={estado} />
      <input type="hidden" name="vistoriaId" value={vistoriaId} />
      <input type="hidden" name="recebimentoId" value={recebimentoId} />
      <ol className="space-y-4">
        {perguntas.map((p) => {
          const nome = `resposta_${p.id}`;
          const erro = estado.errosCampo?.[nome];
          const idCampo = `campo-${p.id}`;
          const opcoes =
            FIXAS[p.tipoResposta] ?? (p.opcoes ?? []).map((o) => [o, o] as [string, string]);
          return (
            <li key={p.id} className="space-y-2 rounded-md border border-borda bg-superficie p-3">
              <fieldset aria-describedby={`${idCampo}-regra${erro ? ` ${idCampo}-erro` : ""}`}>
                <legend
                  className={
                    p.obrigatoria
                      ? "font-medium after:ml-1 after:text-perigo after:content-['*'_/_'']"
                      : "font-medium"
                  }
                >
                  {p.ordem}. {p.texto}
                </legend>
                <p id={`${idCampo}-regra`} className="text-sm text-texto-suave">
                  {p.obrigatoria ? "Obrigatória" : "Opcional"} · {p.regraFoto}
                </p>
                <div className="mt-2">
                  {opcoes.length ? (
                    opcoes.length <= 3 ? (
                      <div className="flex flex-wrap gap-x-4">
                        {opcoes.map(([v, r]) => (
                          <label key={v} className="flex min-h-11 items-center gap-2">
                            <input
                              type="radio"
                              name={nome}
                              value={v}
                              defaultChecked={valor(p.id) === v}
                              className="size-5 accent-[var(--primaria)]"
                            />
                            {r}
                          </label>
                        ))}
                        {!p.obrigatoria ? (
                          <label className="flex min-h-11 items-center gap-2 text-texto-suave">
                            <input
                              type="radio"
                              name={nome}
                              value=""
                              defaultChecked={valor(p.id) === ""}
                              className="size-5"
                            />
                            Sem resposta
                          </label>
                        ) : null}
                      </div>
                    ) : (
                      <Select
                        id={idCampo}
                        name={nome}
                        defaultValue={valor(p.id)}
                        aria-label={p.texto}
                      >
                        <option value="">Selecione…</option>
                        {opcoes.map(([v, r]) => (
                          <option key={v} value={v}>
                            {r}
                          </option>
                        ))}
                      </Select>
                    )
                  ) : p.tipoResposta === "NUMERO" ? (
                    <Input
                      id={idCampo}
                      name={nome}
                      inputMode="decimal"
                      defaultValue={valor(p.id)}
                      aria-label={p.texto}
                    />
                  ) : (
                    <Textarea
                      id={idCampo}
                      name={nome}
                      defaultValue={valor(p.id)}
                      maxLength={1000}
                      aria-label={p.texto}
                    />
                  )}
                </div>
                {erro ? (
                  <p id={`${idCampo}-erro`} className="mt-1 text-sm text-perigo">
                    {erro}
                  </p>
                ) : null}
              </fieldset>
              {fotos[p.id]}
            </li>
          );
        })}
      </ol>
      <SubmitButton pendente="Salvando…">Salvar respostas</SubmitButton>
    </form>
  );
}
