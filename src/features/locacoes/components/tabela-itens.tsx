import { Package, Pencil } from "lucide-react";
import Link from "next/link";

import { AcaoConfirmada } from "@/components/forms/acao-confirmada";
import { DataTable } from "@/components/tables/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatarMoeda, formatarQuantidade } from "@/lib/format/moeda";

import { excluirItem } from "../actions";
import { type ItemLocacao } from "../queries";
import { ROTULO_PERIODICIDADE } from "../rotulos";

export function TabelaItens({
  itens,
  locacaoId,
  editavel,
  mostrarSaldos,
}: {
  itens: ItemLocacao[];
  locacaoId: string;
  editavel: boolean;
  mostrarSaldos: boolean;
}) {
  return (
    <DataTable<ItemLocacao>
      legenda="Itens contratados"
      linhas={itens}
      chaveLinha={(i) => i.id}
      vazio={
        <EmptyState
          icone={Package}
          titulo="Nenhum item contratado"
          descricao="Inclua ao menos um item para ativar a locação."
        />
      }
      colunas={[
        {
          chave: "descricao",
          titulo: "Item",
          principal: true,
          render: (i) => <span className="font-medium">{i.descricao}</span>,
        },
        { chave: "categoria", titulo: "Categoria", render: (i) => i.categoria },
        {
          chave: "modo",
          titulo: "Controle",
          render: (i) => (
            <Badge tom={i.modoControle === "INDIVIDUAL" ? "info" : "neutro"}>
              {i.modoControle === "INDIVIDUAL" ? "Individual" : "Lote"}
            </Badge>
          ),
        },
        {
          chave: "qtd",
          titulo: "Contratado",
          render: (i) => `${formatarQuantidade(i.quantidadeContratada)} ${i.unidade}`,
        },
        {
          chave: "valor",
          titulo: "Valor unitário",
          render: (i) =>
            `${formatarMoeda(i.valorUnitario)} / ${ROTULO_PERIODICIDADE[i.periodicidade].toLowerCase()}`,
        },
        ...(mostrarSaldos
          ? [
              {
                chave: "recebido",
                titulo: "Recebido",
                render: (i: ItemLocacao) => formatarQuantidade(i.recebida),
              },
              {
                chave: "devolvido",
                titulo: "Devolvido",
                render: (i: ItemLocacao) => formatarQuantidade(i.devolvida),
              },
              {
                chave: "saldo",
                titulo: "Saldo em posse",
                render: (i: ItemLocacao) => formatarQuantidade(i.saldo),
              },
            ]
          : []),
        ...(editavel
          ? [
              {
                chave: "acoes",
                titulo: "Ações",
                render: (i: ItemLocacao) => (
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variante="secundaria">
                      <Link
                        href={`/locacoes/${locacaoId}/editar?etapa=itens&item=${i.id}`}
                        aria-label={`Editar ${i.descricao}`}
                      >
                        <Pencil aria-hidden /> Editar
                      </Link>
                    </Button>
                    <AcaoConfirmada
                      acao={excluirItem}
                      campos={{ id: i.id, locacaoId }}
                      rotulo="Excluir"
                      variante="secundaria"
                      perigoso
                      titulo={`Excluir o item “${i.descricao}”?`}
                      descricao="Permitido apenas em rascunho. A exclusão fica registrada na auditoria."
                      rotuloConfirmar="Excluir item"
                    />
                  </div>
                ),
              },
            ]
          : []),
      ]}
    />
  );
}
