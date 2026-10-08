"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { ESTADO_INICIAL } from "@/lib/actions/estado";

import { CampoCheckbox, CampoTexto } from "../../components/campos";
import { salvarPergunta } from "../actions";
import { type Pergunta } from "../queries";
import {
  linhas,
  MODOS_FOTO,
  RESPOSTAS_FIXAS,
  ROTULO_MODO_FOTO,
  ROTULO_TIPO_RESPOSTA,
  TIPOS_RESPOSTA,
  type ModoFoto,
  type TipoResposta,
} from "../schemas";

export function FormPergunta({
  modeloId,
  pergunta,
  proximaOrdem,
}: {
  modeloId: string;
  pergunta?: Pergunta;
  proximaOrdem: number;
}) {
  const [estado, acao] = useActionState(salvarPergunta, ESTADO_INICIAL);
  const v = estado.valores;
  const [tipo, setTipo] = useState<TipoResposta>(
    (v?.tipoResposta as TipoResposta | undefined) ??
      pergunta?.tipoResposta ??
      "CONFORME_NAO_CONFORME",
  );
  const [opcoes, setOpcoes] = useState(v?.opcoes ?? pergunta?.opcoes?.join("\n") ?? "");
  const [modoFoto, setModoFoto] = useState<ModoFoto>(
    (v?.fotoModo as ModoFoto | undefined) ?? pergunta?.exigeFoto.modo ?? "NUNCA",
  );
  const respostasIniciais = new Set(
    v?.fotoRespostas !== undefined
      ? linhas(v.fotoRespostas)
      : pergunta?.exigeFoto.modo === "RESPOSTAS"
        ? pergunta.exigeFoto.respostas
        : [],
  );
  const respostasPossiveis: [string, string][] =
    tipo === "OPCAO_UNICA"
      ? linhas(opcoes).map((o) => [o, o])
      : (RESPOSTAS_FIXAS[tipo]?.map(([a, b]) => [a, b] as [string, string]) ?? []);
  const erros = estado.errosCampo ?? {};

  return (
    <form
      action={acao}
      className="space-y-4 rounded-md border border-borda bg-superficie p-4"
      noValidate
    >
      <h3 className="text-lg font-semibold">
        {pergunta ? `Editar pergunta ${pergunta.ordem}` : "Nova pergunta"}
      </h3>
      <FormAlert estado={estado} />
      <input type="hidden" name="modeloId" value={modeloId} />
      {pergunta ? <input type="hidden" name="id" value={pergunta.id} /> : null}
      <div className="grid gap-4 md:grid-cols-[8rem_1fr]">
        <CampoTexto
          estado={estado}
          nome="ordem"
          rotulo="Ordem"
          tipo="number"
          inputMode="numeric"
          inicial={String(pergunta?.ordem ?? proximaOrdem)}
          obrigatorio
        />
        <CampoTexto
          estado={estado}
          nome="texto"
          rotulo="Pergunta"
          inicial={pergunta?.texto}
          obrigatorio
        />
      </div>
      <FormField
        nome="tipoResposta"
        rotulo="Tipo de resposta"
        erro={erros.tipoResposta}
        obrigatorio
      >
        {(a) => (
          <Select {...a} value={tipo} onChange={(e) => setTipo(e.target.value as TipoResposta)}>
            {TIPOS_RESPOSTA.map((t) => (
              <option key={t} value={t}>
                {ROTULO_TIPO_RESPOSTA[t]}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      {tipo === "OPCAO_UNICA" ? (
        <FormField nome="opcoes" rotulo="Opções (uma por linha)" erro={erros.opcoes} obrigatorio>
          {(a) => <Textarea {...a} value={opcoes} onChange={(e) => setOpcoes(e.target.value)} />}
        </FormField>
      ) : (
        <input type="hidden" name="opcoes" value="" />
      )}
      <CampoCheckbox
        estado={estado}
        nome="obrigatoria"
        rotulo="Resposta obrigatória"
        inicial={pergunta?.obrigatoria ?? true}
      />
      <FormField nome="fotoModo" rotulo="Exigir foto" erro={erros.fotoModo} obrigatorio>
        {(a) => (
          <Select {...a} value={modoFoto} onChange={(e) => setModoFoto(e.target.value as ModoFoto)}>
            {MODOS_FOTO.map((m) => (
              <option key={m} value={m}>
                {ROTULO_MODO_FOTO[m]}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      {modoFoto === "RESPOSTAS" ? (
        <fieldset
          className="space-y-1"
          aria-describedby={erros.fotoRespostas ? "fotoRespostas-erro" : undefined}
        >
          <legend className="font-medium">Respostas que exigem foto</legend>
          {respostasPossiveis.length === 0 ? (
            <p className="text-texto-suave">
              Este tipo de resposta não tem opções fixas; use Nunca ou Sempre.
            </p>
          ) : (
            respostasPossiveis.map(([valor, rotulo]) => (
              <label key={valor} className="flex min-h-11 items-center gap-3">
                <input
                  type="checkbox"
                  name="fotoRespostas"
                  value={valor}
                  defaultChecked={respostasIniciais.has(valor)}
                  className="size-5 accent-[var(--primaria)]"
                />
                <span>{rotulo}</span>
              </label>
            ))
          )}
          {erros.fotoRespostas ? (
            <p id="fotoRespostas-erro" className="text-sm text-perigo">
              {erros.fotoRespostas}
            </p>
          ) : null}
        </fieldset>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <SubmitButton pendente="Salvando…">
          {pergunta ? "Salvar pergunta" : "Adicionar pergunta"}
        </SubmitButton>
        <Button asChild variante="secundaria">
          <Link href={`/cadastros/checklists/${modeloId}`}>Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
