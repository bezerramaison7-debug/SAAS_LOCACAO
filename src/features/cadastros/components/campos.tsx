"use client";

import { FormField } from "@/components/forms/form-field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { type EstadoAcao } from "@/lib/actions/estado";

/** Campos de formulário ligados ao estado da Server Action (erro + valor reenviado). */
type Base = {
  estado: EstadoAcao;
  nome: string;
  rotulo: string;
  inicial?: string | null | undefined;
  obrigatorio?: boolean;
  descricao?: string;
};

function valor(estado: EstadoAcao, nome: string, inicial: string | null | undefined): string {
  return estado.valores?.[nome] ?? inicial ?? "";
}

export function CampoTexto({
  estado,
  nome,
  rotulo,
  inicial,
  obrigatorio = false,
  descricao,
  tipo = "text",
  ...resto
}: Base & {
  tipo?: string;
  inputMode?: "text" | "numeric" | "decimal" | "email" | "tel";
  autoComplete?: string;
}) {
  return (
    <FormField
      nome={nome}
      rotulo={rotulo}
      erro={estado.errosCampo?.[nome]}
      obrigatorio={obrigatorio}
      {...(descricao ? { descricao } : {})}
    >
      {(a) => <Input {...a} type={tipo} defaultValue={valor(estado, nome, inicial)} {...resto} />}
    </FormField>
  );
}

export function CampoAreaTexto({
  estado,
  nome,
  rotulo,
  inicial,
  obrigatorio = false,
  descricao,
}: Base) {
  return (
    <FormField
      nome={nome}
      rotulo={rotulo}
      erro={estado.errosCampo?.[nome]}
      obrigatorio={obrigatorio}
      {...(descricao ? { descricao } : {})}
    >
      {(a) => <Textarea {...a} defaultValue={valor(estado, nome, inicial)} />}
    </FormField>
  );
}

export function CampoSelecao({
  estado,
  nome,
  rotulo,
  inicial,
  obrigatorio = false,
  descricao,
  opcoes,
  vazio,
}: Base & { opcoes: readonly { valor: string; rotulo: string }[]; vazio?: string }) {
  return (
    <FormField
      nome={nome}
      rotulo={rotulo}
      erro={estado.errosCampo?.[nome]}
      obrigatorio={obrigatorio}
      {...(descricao ? { descricao } : {})}
    >
      {(a) => (
        <Select {...a} defaultValue={valor(estado, nome, inicial)}>
          {vazio !== undefined ? <option value="">{vazio}</option> : null}
          {opcoes.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </Select>
      )}
    </FormField>
  );
}

export function CampoCheckbox({
  estado,
  nome,
  rotulo,
  inicial,
  descricao,
}: Omit<Base, "inicial" | "obrigatorio"> & { inicial: boolean }) {
  const marcado = estado.valores ? estado.valores[nome] === "on" : inicial;
  return (
    <div className="flex flex-col gap-1">
      <label className="flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          name={nome}
          defaultChecked={marcado}
          className="size-5 accent-[var(--primaria)]"
        />
        <span>{rotulo}</span>
      </label>
      {descricao ? <p className="text-sm text-texto-suave">{descricao}</p> : null}
    </div>
  );
}
