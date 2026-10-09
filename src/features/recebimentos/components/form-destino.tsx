"use client";

import { useActionState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { CampoAreaTexto, CampoSelecao, CampoTexto } from "@/features/cadastros/components/campos";
import { ESTADO_INICIAL } from "@/lib/actions/estado";

import { salvarDestino } from "../actions";

type Opcao = { id: string; rotulo: string };

export function FormDestino({
  recebimentoId,
  locais,
  responsaveis,
  inicial,
}: {
  recebimentoId: string;
  locais: Opcao[];
  responsaveis: Opcao[];
  inicial: {
    dataEvento: string;
    localId: string | null;
    responsavelId: string | null;
    observacoes: string | null;
  };
}) {
  const [estado, acao] = useActionState(salvarDestino, ESTADO_INICIAL);
  const opcoes = (lista: Opcao[]) => lista.map((o) => ({ valor: o.id, rotulo: o.rotulo }));
  return (
    <form action={acao} className="max-w-3xl space-y-4" noValidate>
      <FormAlert estado={estado} />
      <input type="hidden" name="recebimentoId" value={recebimentoId} />
      <div className="grid gap-4 md:grid-cols-2">
        <CampoTexto
          estado={estado}
          nome="dataEvento"
          rotulo="Data e hora do recebimento"
          tipo="datetime-local"
          inicial={inicial.dataEvento}
          obrigatorio
          descricao="Quando os itens chegaram (horário da empresa). Não pode estar no futuro."
        />
        <CampoSelecao
          estado={estado}
          nome="localId"
          rotulo="Local onde ficarão"
          inicial={inicial.localId}
          vazio="Selecione…"
          opcoes={opcoes(locais)}
          obrigatorio
        />
        <CampoSelecao
          estado={estado}
          nome="responsavelId"
          rotulo="Responsável pelos itens"
          inicial={inicial.responsavelId}
          vazio="Selecione…"
          opcoes={opcoes(responsaveis)}
          obrigatorio
        />
      </div>
      <CampoAreaTexto
        estado={estado}
        nome="observacoes"
        rotulo="Observações"
        inicial={inicial.observacoes}
      />
      <SubmitButton pendente="Salvando…">Salvar e revisar</SubmitButton>
    </form>
  );
}
