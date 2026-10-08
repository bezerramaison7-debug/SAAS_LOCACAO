"use client";

import { useActionState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { CampoSelecao } from "@/features/cadastros/components/campos";
import { ESTADO_INICIAL } from "@/lib/actions/estado";

import { criarRecebimento } from "../actions";

export function FormNovoRecebimento({
  locacoes,
  inicial,
}: {
  locacoes: { id: string; rotulo: string }[];
  inicial?: string;
}) {
  const [estado, acao] = useActionState(criarRecebimento, ESTADO_INICIAL);
  return (
    <form action={acao} className="max-w-xl space-y-4" noValidate>
      <FormAlert estado={estado} />
      <CampoSelecao
        estado={estado}
        nome="locacaoId"
        rotulo="Locação"
        obrigatorio
        inicial={inicial}
        vazio="Selecione…"
        opcoes={locacoes.map((l) => ({ valor: l.id, rotulo: l.rotulo }))}
        descricao="Somente locações ativas recebem itens."
      />
      <SubmitButton pendente="Criando…">Iniciar recebimento</SubmitButton>
    </form>
  );
}
