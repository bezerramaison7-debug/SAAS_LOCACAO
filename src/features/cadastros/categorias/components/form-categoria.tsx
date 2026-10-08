"use client";

import { useActionState, useState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { ESTADO_INICIAL } from "@/lib/actions/estado";

import { CampoCheckbox, CampoSelecao, CampoTexto } from "../../components/campos";
import { salvarCategoria } from "../actions";
import { type Categoria } from "../queries";
import { MODOS_CONTROLE, ROTULO_MODO_CONTROLE, type ModoControle } from "../schemas";

const OPCOES_MODO = MODOS_CONTROLE.map((m) => ({ valor: m, rotulo: ROTULO_MODO_CONTROLE[m] }));

export function FormCategoria({
  categoria,
  familias,
}: {
  categoria?: Categoria;
  familias: { valor: string; rotulo: string }[];
}) {
  const [estado, acao] = useActionState(salvarCategoria, ESTADO_INICIAL);
  const [modo, setModo] = useState<ModoControle>(categoria?.modoControle ?? "INDIVIDUAL");
  const erroModo = estado.errosCampo?.modoControle;
  // Família vinculada que não tem mais versão publicada continua visível.
  const opcoesFamilia =
    categoria?.checklistFamiliaId && !familias.some((f) => f.valor === categoria.checklistFamiliaId)
      ? [
          ...familias,
          { valor: categoria.checklistFamiliaId, rotulo: "Família sem versão publicada" },
        ]
      : familias;

  return (
    <form action={acao} className="max-w-3xl space-y-4" noValidate>
      <FormAlert estado={estado} />
      {categoria ? <input type="hidden" name="id" value={categoria.id} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <CampoTexto
          estado={estado}
          nome="nome"
          rotulo="Nome"
          inicial={categoria?.nome}
          obrigatorio
        />
        <CampoTexto
          estado={estado}
          nome="unidadePadrao"
          rotulo="Unidade padrão"
          inicial={categoria?.unidadePadrao ?? "un"}
          obrigatorio
        />
      </div>

      <fieldset className="space-y-2">
        <legend
          className={
            categoria
              ? "font-medium"
              : "font-medium after:ml-1 after:text-perigo after:content-['*'_/_'']"
          }
        >
          Modo de controle
        </legend>
        {categoria ? (
          <p className="text-texto-suave">
            {ROTULO_MODO_CONTROLE[categoria.modoControle]} — definido na criação; não pode ser
            alterado.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {OPCOES_MODO.map((o) => (
              <label key={o.valor} className="flex min-h-11 items-center gap-3">
                <input
                  type="radio"
                  name="modoControle"
                  value={o.valor}
                  checked={modo === o.valor}
                  onChange={() => setModo(o.valor)}
                  className="size-5 accent-[var(--primaria)]"
                  aria-describedby={erroModo ? "modoControle-erro" : undefined}
                />
                <span>{o.rotulo}</span>
              </label>
            ))}
            {erroModo ? (
              <p id="modoControle-erro" className="text-sm text-perigo">
                {erroModo}
              </p>
            ) : null}
          </div>
        )}
      </fieldset>

      <CampoSelecao
        estado={estado}
        nome="checklistFamiliaId"
        rotulo="Checklist de vistoria"
        inicial={categoria?.checklistFamiliaId}
        opcoes={opcoesFamilia}
        vazio="Sem checklist"
        descricao="A versão vigente é usada no momento da vistoria e fica registrada nela."
      />

      <fieldset className="space-y-1">
        <legend className="font-medium">Exigências</legend>
        {modo === "INDIVIDUAL" ? (
          <>
            <CampoCheckbox
              estado={estado}
              nome="exigeNumeroSerie"
              rotulo="Exigir número de série"
              inicial={categoria?.exigeNumeroSerie ?? false}
            />
            <CampoCheckbox
              estado={estado}
              nome="exigePlaca"
              rotulo="Exigir placa"
              inicial={categoria?.exigePlaca ?? false}
            />
            <CampoCheckbox
              estado={estado}
              nome="exigeIdentFornecedor"
              rotulo="Exigir identificação do fornecedor (patrimônio)"
              inicial={categoria?.exigeIdentFornecedor ?? false}
            />
          </>
        ) : null}
        <CampoCheckbox
          estado={estado}
          nome="exigeVistoriaSaida"
          rotulo="Exigir vistoria na devolução"
          inicial={categoria?.exigeVistoriaSaida ?? true}
        />
      </fieldset>

      <CampoCheckbox
        estado={estado}
        nome="ativo"
        rotulo="Ativa"
        inicial={categoria?.ativo ?? true}
        descricao="Categoria inativa não pode ser usada em novos itens. Nada é excluído."
      />
      <SubmitButton pendente="Salvando…">
        {categoria ? "Salvar alterações" : "Cadastrar categoria"}
      </SubmitButton>
    </form>
  );
}
