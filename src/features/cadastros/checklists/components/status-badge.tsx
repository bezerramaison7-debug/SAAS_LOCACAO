import { Badge } from "@/components/ui/badge";

import { ROTULO_STATUS_CHECKLIST, type StatusChecklist } from "../schemas";

const TOM = { RASCUNHO: "alerta", PUBLICADO: "sucesso", ARQUIVADO: "neutro" } as const;

export function StatusChecklistBadge({ status }: { status: StatusChecklist }) {
  return <Badge tom={TOM[status]}>{ROTULO_STATUS_CHECKLIST[status]}</Badge>;
}
