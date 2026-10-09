import { DataTable } from "@/components/tables/data-table";
import { AcaoConfirmada } from "@/components/forms/acao-confirmada";
import { EmptyState } from "@/components/ui/empty-state";
import { formatarDataCivil } from "@/lib/format/datas";
import { Link2 } from "lucide-react";

import { excluirReferencia } from "../actions";
import { type Referencia } from "../queries";
import { ROTULO_SISTEMA, ROTULO_TIPO_REFERENCIA } from "../rotulos";

export function ListaReferencias({
  referencias,
  locacaoId,
  podeExcluir,
}: {
  referencias: Referencia[];
  locacaoId: string;
  podeExcluir: boolean;
}) {
  return (
    <DataTable<Referencia>
      legenda="Documentos vinculados"
      linhas={referencias}
      chaveLinha={(r) => r.id}
      vazio={
        <EmptyState
          icone={Link2}
          titulo="Nenhum documento vinculado"
          descricao="Vincule ao menos o pedido de compra do Sectra."
        />
      }
      colunas={[
        {
          chave: "numero",
          titulo: "Número",
          principal: true,
          render: (r) => <span className="font-mono font-medium">{r.numero}</span>,
        },
        { chave: "tipo", titulo: "Tipo", render: (r) => ROTULO_TIPO_REFERENCIA[r.tipo] },
        { chave: "sistema", titulo: "Sistema", render: (r) => ROTULO_SISTEMA[r.sistema] },
        {
          chave: "data",
          titulo: "Data",
          render: (r) => (r.dataDocumento ? formatarDataCivil(r.dataDocumento) : "—"),
        },
        { chave: "obs", titulo: "Observação", render: (r) => r.observacao ?? "—" },
        ...(podeExcluir
          ? [
              {
                chave: "acoes",
                titulo: "Ações",
                render: (r: Referencia) => (
                  <AcaoConfirmada
                    acao={excluirReferencia}
                    campos={{ id: r.id, locacaoId }}
                    rotulo="Remover"
                    variante="secundaria"
                    perigoso
                    titulo={`Remover o documento ${r.numero}?`}
                    descricao="O vínculo é desfeito (permitido apenas em rascunho). A remoção fica registrada na auditoria."
                    rotuloConfirmar="Remover vínculo"
                  />
                ),
              },
            ]
          : []),
      ]}
    />
  );
}
