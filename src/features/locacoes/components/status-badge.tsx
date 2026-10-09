import { Badge } from "@/components/ui/badge";

import { ROTULO_STATUS_FINANCEIRO, ROTULO_STATUS_LOCACAO, TOM_STATUS_LOCACAO } from "../rotulos";
import { type StatusFinanceiro, type StatusLocacao } from "../rules/maquina-estado";

export function StatusLocacaoBadge({ status }: { status: StatusLocacao }) {
  return <Badge tom={TOM_STATUS_LOCACAO[status]}>{ROTULO_STATUS_LOCACAO[status]}</Badge>;
}

export function StatusFinanceiroBadge({ status }: { status: StatusFinanceiro }) {
  return (
    <Badge tom={status === "ENCERRADO" ? "neutro" : "info"}>
      Financeiro: {ROTULO_STATUS_FINANCEIRO[status]}
    </Badge>
  );
}
