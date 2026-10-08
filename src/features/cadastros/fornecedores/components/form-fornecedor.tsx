"use client";

import { useActionState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { ESTADO_INICIAL } from "@/lib/actions/estado";

import { CampoAreaTexto, CampoCheckbox, CampoTexto } from "../../components/campos";
import { salvarFornecedor } from "../actions";
import { type Fornecedor } from "../queries";

export function FormFornecedor({ fornecedor }: { fornecedor?: Fornecedor }) {
  const [estado, acao] = useActionState(salvarFornecedor, ESTADO_INICIAL);
  return (
    <form action={acao} className="max-w-3xl space-y-4" noValidate>
      <FormAlert estado={estado} />
      {fornecedor ? <input type="hidden" name="id" value={fornecedor.id} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <CampoTexto
          estado={estado}
          nome="razaoSocial"
          rotulo="Razão social"
          inicial={fornecedor?.razaoSocial}
          obrigatorio
        />
        <CampoTexto
          estado={estado}
          nome="nomeFantasia"
          rotulo="Nome fantasia"
          inicial={fornecedor?.nomeFantasia}
        />
        <CampoTexto
          estado={estado}
          nome="documento"
          rotulo="CNPJ/CPF"
          inicial={fornecedor?.documento}
          inputMode="numeric"
        />
        <CampoTexto
          estado={estado}
          nome="contatoNome"
          rotulo="Contato"
          inicial={fornecedor?.contatoNome}
        />
        <CampoTexto
          estado={estado}
          nome="contatoEmail"
          rotulo="E-mail do contato"
          tipo="email"
          inicial={fornecedor?.contatoEmail}
        />
        <CampoTexto
          estado={estado}
          nome="contatoTelefone"
          rotulo="Telefone do contato"
          tipo="tel"
          inicial={fornecedor?.contatoTelefone}
        />
      </div>
      <CampoAreaTexto
        estado={estado}
        nome="observacoes"
        rotulo="Observações"
        inicial={fornecedor?.observacoes}
      />
      <CampoCheckbox
        estado={estado}
        nome="ativo"
        rotulo="Ativo"
        inicial={fornecedor?.ativo ?? true}
        descricao="Fornecedor inativo não pode ser usado em novas locações. Nada é excluído."
      />
      <SubmitButton pendente="Salvando…">
        {fornecedor ? "Salvar alterações" : "Cadastrar fornecedor"}
      </SubmitButton>
    </form>
  );
}
