import { Badge } from "@/components/ui/badge";
import { ROTULO_STATUS_RECEBIMENTO } from "@/features/locacoes/rotulos-eventos";

import { TOM_STATUS_RECEBIMENTO, type StatusRecebimento } from "../rotulos";

export function StatusRecebimentoBadge({ status }: { status: StatusRecebimento }) {
  return (
    <Badge tom={TOM_STATUS_RECEBIMENTO[status]}>
      {ROTULO_STATUS_RECEBIMENTO[status] ?? status}
    </Badge>
  );
}
