"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { CampoSelecao, CampoTexto } from "@/features/cadastros/components/campos";
import { ESTADO_INICIAL } from "@/lib/actions/estado";
import { useHidratado } from "@/lib/hooks/hidratado";
import { formatarQuantidade, valorEditavelBR } from "@/lib/format/moeda";

import { salvarItem } from "../actions";
import { type ItemLocacao } from "../queries";
import { PERIODICIDADES, ROTULO_PERIODICIDADE } from "../rotulos";

export type OpcaoCategoria = {
  id: string;
  nome: string;
  modoControle: "INDIVIDUAL" | "LOTE";
  unidadePadrao: string;
};

const OPCOES_PERIODICIDADE = PERIODICIDADES.map((p) => ({
  valor: p,
  rotulo: ROTULO_PERIODICIDADE[p],
}));

export function FormItem({
  locacaoId,
  item,
  categorias,
}: {
  locacaoId: string;
  item?: ItemLocacao;
  categorias: OpcaoCategoria[];
}) {
  const [estado, acao] = useActionState(salvarItem, ESTADO_INICIAL);
  const hidratado = useHidratado();
  const [categoriaId, setCategoriaId] = useState(
    estado.valores?.categoriaId ?? item?.categoriaId ?? "",
  );
  const [unidade, setUnidade] = useState(estado.valores?.unidade ?? item?.unidade ?? "");
  const categoria = categorias.find((c) => c.id === categoriaId);
  const opcoes =
    item && !categorias.some((c) => c.id === item.categoriaId)
      ? [
          ...categorias,
          {
            id: item.categoriaId,
            nome: `${item.categoria} (inativa)`,
            modoControle: item.modoControle,
            unidadePadrao: item.unidade,
          },
        ]
      : categorias;

  return (
    <form
      action={acao}
      className="space-y-4 rounded-md border border-borda bg-superficie p-4"
      noValidate
    >
      <h3 className="text-lg font-semibold">{item ? "Editar item" : "Novo item contratado"}</h3>
      <FormAlert estado={estado} />
      <input type="hidden" name="locacaoId" value={locacaoId} />
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <FormField
        nome="categoriaId"
        rotulo="Categoria"
        erro={estado.errosCampo?.categoriaId}
        obrigatorio
        descricao={
          categoria
            ? categoria.modoControle === "INDIVIDUAL"
              ? "Controle individual: cada unidade vira um bem identificado no recebimento."
              : "Controle por lote: a quantidade é controlada em conjunto (aceita fração)."
            : "O modo de controle (individual ou lote) vem da categoria."
        }
      >
        {(a) => (
          <Select
            {...a}
            disabled={!hidratado}
            value={categoriaId}
            onChange={(e) => {
              setCategoriaId(e.target.value);
              const nova = categorias.find((c) => c.id === e.target.value);
              if (nova && !unidade) setUnidade(nova.unidadePadrao);
            }}
          >
            <option value="">Selecione…</option>
            {opcoes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} — {c.modoControle === "INDIVIDUAL" ? "individual" : "lote"}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <CampoTexto
        estado={estado}
        nome="descricao"
        rotulo="Descrição do item"
        inicial={item?.descricao}
        obrigatorio
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <CampoTexto
          estado={estado}
          nome="quantidade"
          rotulo="Quantidade contratada"
          inputMode={categoria?.modoControle === "INDIVIDUAL" ? "numeric" : "decimal"}
          inicial={item ? formatarQuantidade(item.quantidadeContratada) : undefined}
          obrigatorio
        />
        <FormField nome="unidade" rotulo="Unidade" erro={estado.errosCampo?.unidade} obrigatorio>
          {(a) => (
            <Input
              {...a}
              disabled={!hidratado}
              value={unidade}
              onChange={(e) => setUnidade(e.target.value)}
            />
          )}
        </FormField>
        <CampoTexto
          estado={estado}
          nome="valorUnitario"
          rotulo="Valor unitário (R$)"
          inputMode="decimal"
          inicial={item ? valorEditavelBR(item.valorUnitario) : undefined}
          descricao="Por período. Ex.: 1.234,56"
          obrigatorio
        />
      </div>
      <CampoSelecao
        estado={estado}
        nome="periodicidade"
        rotulo="Periodicidade da cobrança"
        inicial={item?.periodicidade ?? "MENSAL"}
        opcoes={OPCOES_PERIODICIDADE}
        obrigatorio
      />
      <CampoTexto
        estado={estado}
        nome="observacao"
        rotulo="Observação"
        inicial={item?.observacao}
      />
      <div className="flex flex-wrap gap-2">
        <SubmitButton pendente="Salvando…">{item ? "Salvar item" : "Adicionar item"}</SubmitButton>
        {item ? (
          <Button asChild variante="secundaria">
            <Link href={`/locacoes/${locacaoId}/editar?etapa=itens`}>Cancelar edição</Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}
