"use client";

import { useActionState, useEffect, useRef } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { CampoSelecao, CampoTexto } from "@/features/cadastros/components/campos";
import { ESTADO_INICIAL } from "@/lib/actions/estado";

import { adicionarBem, atualizarBem, definirLote } from "../actions";
import { CONDICOES, ROTULO_CONDICAO } from "../rotulos";

const OPCOES_CONDICAO = CONDICOES.map((c) => ({ valor: c, rotulo: ROTULO_CONDICAO[c] }));

type Exige = { exigeNumeroSerie: boolean; exigePlaca: boolean; exigeIdentFornecedor: boolean };

function CamposExigencia({ exige }: { exige: Exige }) {
  return (
    <>
      <input type="hidden" name="exigeNumeroSerie" value={exige.exigeNumeroSerie ? "1" : "0"} />
      <input type="hidden" name="exigePlaca" value={exige.exigePlaca ? "1" : "0"} />
      <input
        type="hidden"
        name="exigeIdentFornecedor"
        value={exige.exigeIdentFornecedor ? "1" : "0"}
      />
    </>
  );
}

/** Uma unidade de item INDIVIDUAL: cada uma vira um bem com código próprio (RN-23). */
export function FormNovoBem({
  recebimentoId,
  itemLocacaoId,
  exige,
  descricao,
}: {
  recebimentoId: string;
  itemLocacaoId: string;
  exige: Exige;
  descricao: string;
}) {
  const [estado, acao] = useActionState(adicionarBem, ESTADO_INICIAL);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado.status === "sucesso") form.current?.reset();
  }, [estado]);
  return (
    <form
      ref={form}
      action={acao}
      className="space-y-3"
      noValidate
      aria-label={`Incluir unidade de ${descricao}`}
    >
      <FormAlert estado={estado} />
      <input type="hidden" name="recebimentoId" value={recebimentoId} />
      <input type="hidden" name="itemLocacaoId" value={itemLocacaoId} />
      <CamposExigencia exige={exige} />
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoTexto
          estado={estado}
          nome="numeroSerie"
          rotulo="Número de série"
          obrigatorio={exige.exigeNumeroSerie}
          autoComplete="off"
        />
        {exige.exigePlaca ? (
          <CampoTexto estado={estado} nome="placa" rotulo="Placa" obrigatorio autoComplete="off" />
        ) : null}
        {exige.exigeIdentFornecedor ? (
          <CampoTexto
            estado={estado}
            nome="identificacaoFornecedor"
            rotulo="Patrimônio do fornecedor"
            obrigatorio
            autoComplete="off"
          />
        ) : null}
        <CampoSelecao
          estado={estado}
          nome="condicao"
          rotulo="Condição"
          inicial="BOM"
          opcoes={OPCOES_CONDICAO}
          obrigatorio
        />
      </div>
      <CampoTexto estado={estado} nome="observacao" rotulo="Observação" />
      <SubmitButton pendente="Incluindo…">Incluir unidade</SubmitButton>
    </form>
  );
}

export function FormEditarBem({
  recebimentoId,
  linhaId,
  bemId,
  exige,
  inicial,
}: {
  recebimentoId: string;
  linhaId: string;
  bemId: string;
  exige: Exige;
  inicial: {
    numeroSerie: string | null;
    placa: string | null;
    identificacaoFornecedor: string | null;
    condicao: string;
    observacao: string | null;
  };
}) {
  const [estado, acao] = useActionState(atualizarBem, ESTADO_INICIAL);
  return (
    <form action={acao} className="space-y-3" noValidate>
      <FormAlert estado={estado} />
      <input type="hidden" name="recebimentoId" value={recebimentoId} />
      <input type="hidden" name="linhaId" value={linhaId} />
      <input type="hidden" name="bemId" value={bemId} />
      <CamposExigencia exige={exige} />
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoTexto
          estado={estado}
          nome="numeroSerie"
          rotulo="Número de série"
          inicial={inicial.numeroSerie}
          obrigatorio={exige.exigeNumeroSerie}
        />
        <CampoTexto
          estado={estado}
          nome="placa"
          rotulo="Placa"
          inicial={inicial.placa}
          obrigatorio={exige.exigePlaca}
        />
        <CampoTexto
          estado={estado}
          nome="identificacaoFornecedor"
          rotulo="Patrimônio do fornecedor"
          inicial={inicial.identificacaoFornecedor}
          obrigatorio={exige.exigeIdentFornecedor}
        />
        <CampoSelecao
          estado={estado}
          nome="condicao"
          rotulo="Condição"
          inicial={inicial.condicao}
          opcoes={OPCOES_CONDICAO}
          obrigatorio
        />
      </div>
      <CampoTexto
        estado={estado}
        nome="observacao"
        rotulo="Observação"
        inicial={inicial.observacao}
      />
      <SubmitButton pendente="Salvando…">Salvar unidade</SubmitButton>
    </form>
  );
}

/** Item LOTE: uma quantidade por item neste recebimento (RN-24). */
export function FormLote({
  recebimentoId,
  itemLocacaoId,
  unidade,
  inicial,
  descricao,
}: {
  recebimentoId: string;
  itemLocacaoId: string;
  unidade: string;
  inicial?: { quantidade: string; condicao: string; observacao: string | null };
  descricao: string;
}) {
  const [estado, acao] = useActionState(definirLote, ESTADO_INICIAL);
  return (
    <form
      action={acao}
      className="space-y-3"
      noValidate
      aria-label={`Quantidade recebida de ${descricao}`}
    >
      <FormAlert estado={estado} />
      <input type="hidden" name="recebimentoId" value={recebimentoId} />
      <input type="hidden" name="itemLocacaoId" value={itemLocacaoId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoTexto
          estado={estado}
          nome="quantidade"
          rotulo={`Quantidade recebida (${unidade})`}
          inputMode="decimal"
          inicial={inicial?.quantidade}
          obrigatorio
        />
        <CampoSelecao
          estado={estado}
          nome="condicao"
          rotulo="Condição"
          inicial={inicial?.condicao ?? "BOM"}
          opcoes={OPCOES_CONDICAO}
          obrigatorio
        />
      </div>
      <CampoTexto
        estado={estado}
        nome="observacao"
        rotulo="Observação"
        inicial={inicial?.observacao}
      />
      <SubmitButton pendente="Salvando…">
        {inicial ? "Atualizar quantidade" : "Registrar quantidade"}
      </SubmitButton>
    </form>
  );
}
