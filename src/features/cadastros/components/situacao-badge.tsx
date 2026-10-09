import { Badge } from "@/components/ui/badge";

export function SituacaoBadge({ ativo }: { ativo: boolean }) {
  return <Badge tom={ativo ? "sucesso" : "neutro"}>{ativo ? "Ativo" : "Inativo"}</Badge>;
}
