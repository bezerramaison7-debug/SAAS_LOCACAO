"use client";

import { useActionState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { CampoAreaTexto, CampoSelecao } from "@/features/cadastros/components/campos";
import { ESTADO_INICIAL } from "@/lib/actions/estado";

import { salvarIdentificacao } from "../actions";
import { type Locacao } from "../queries";

type Opcao = { id: string; rotulo: string };

export function FormIdentificacao({
  locacao,
  fornecedores,
  centros,
}: {
  locacao?: Locacao;
  fornecedores: Opcao[];
  centros: Opcao[];
}) {
  const [estado, acao] = useActionState(salvarIdentificacao, ESTADO_INICIAL);
  // Mantém visível o vínculo atual mesmo que o cadastro tenha sido inativado.
  const comAtual = (
    opcoes: Opcao[],
    id: string | null | undefined,
    rotulo: string | null | undefined,
  ) =>
    id && !opcoes.some((o) => o.id === id)
      ? [...opcoes, { id, rotulo: `${rotulo ?? "Registro"} (inativo)` }]
      : opcoes;
  const paraOpcoes = (lista: Opcao[]) => lista.map((o) => ({ valor: o.id, rotulo: o.rotulo }));
  return (
    <form action={acao} className="max-w-3xl space-y-4" noValidate>
      <FormAlert estado={estado} />
      {locacao ? <input type="hidden" name="id" value={locacao.id} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <CampoSelecao
          estado={estado}
          nome="fornecedorId"
          rotulo="Fornecedor"
          obrigatorio
          inicial={locacao?.fornecedorId}
          vazio="Selecione…"
          opcoes={paraOpcoes(comAtual(fornecedores, locacao?.fornecedorId, locacao?.fornecedor))}
        />
        <CampoSelecao
          estado={estado}
          nome="centroCustoId"
          rotulo="Centro de custo"
          obrigatorio
          inicial={locacao?.centroCustoId}
          vazio="Selecione…"
          opcoes={paraOpcoes(comAtual(centros, locacao?.centroCustoId, locacao?.centroCusto))}
        />
      </div>
      <CampoAreaTexto
        estado={estado}
        nome="observacoes"
        rotulo="Observações"
        inicial={locacao?.observacoes}
      />
      <SubmitButton pendente="Salvando…">
        {locacao ? "Salvar e continuar" : "Criar rascunho e continuar"}
      </SubmitButton>
    </form>
  );
}
