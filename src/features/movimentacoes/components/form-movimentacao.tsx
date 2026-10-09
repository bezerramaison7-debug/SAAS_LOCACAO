"use client";

import { useActionState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import {
  CampoAreaTexto,
  CampoCheckbox,
  CampoSelecao,
  CampoTexto,
} from "@/features/cadastros/components/campos";
import { ESTADO_INICIAL } from "@/lib/actions/estado";

import { registrarMovimentacao } from "../actions";
import { type AlvoMovimentacao } from "../queries";

type Opcao = { id: string; rotulo: string };

export function FormMovimentacao({
  alvo,
  locais,
  responsaveis,
  agoraLocal,
  saldoTexto,
}: {
  alvo: AlvoMovimentacao;
  locais: Opcao[];
  responsaveis: Opcao[];
  agoraLocal: string;
  saldoTexto: string | null;
}) {
  const [estado, acao] = useActionState(registrarMovimentacao, ESTADO_INICIAL);
  const opcoes = (lista: Opcao[]) => lista.map((o) => ({ valor: o.id, rotulo: o.rotulo }));
  return (
    <form action={acao} className="max-w-3xl space-y-4" noValidate>
      <FormAlert estado={estado} />
      <input type="hidden" name={alvo.tipo === "bem" ? "bemId" : "loteId"} value={alvo.id} />
      {alvo.ultimaConfirmada ? (
        <input type="hidden" name="corrigeId" value={alvo.ultimaConfirmada} />
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <CampoSelecao
          estado={estado}
          nome="destinoLocalId"
          rotulo="Local de destino"
          inicial={alvo.localId}
          vazio="Selecione…"
          opcoes={opcoes(locais)}
          obrigatorio
        />
        <CampoSelecao
          estado={estado}
          nome="novoResponsavelId"
          rotulo="Novo responsável"
          inicial={alvo.responsavelId}
          vazio="Selecione…"
          opcoes={opcoes(responsaveis)}
          obrigatorio
        />
        <CampoTexto
          estado={estado}
          nome="dataEvento"
          rotulo="Data e hora da movimentação"
          tipo="datetime-local"
          inicial={agoraLocal}
          obrigatorio
          descricao="Quando o item mudou de local/responsável. Não pode ser anterior ao último evento."
        />
        {alvo.tipo === "lote" ? (
          <CampoTexto
            estado={estado}
            nome="quantidade"
            rotulo={`Quantidade a movimentar (${alvo.unidade ?? "un"})`}
            inputMode="decimal"
            descricao={`Saldo: ${saldoTexto ?? "—"}. Em branco = todo o disponível; parcial cria um lote novo no destino.`}
          />
        ) : null}
      </div>
      <CampoAreaTexto estado={estado} nome="motivo" rotulo="Motivo" obrigatorio />
      {alvo.ultimaConfirmada ? (
        <CampoCheckbox
          estado={estado}
          nome="correcao"
          rotulo="É uma correção da última movimentação"
          inicial={false}
          descricao="Movimentações confirmadas não são editadas: a correção fica registrada como novo evento, ligado ao anterior."
        />
      ) : null}
      <SubmitButton pendente="Registrando…">Registrar movimentação</SubmitButton>
    </form>
  );
}
