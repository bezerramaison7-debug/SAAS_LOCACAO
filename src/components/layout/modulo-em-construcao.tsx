import { Construction } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";

/**
 * Estado explícito de módulo ainda não entregue. Não simula dados nem
 * oferece ações: apenas informa a fase prevista no plano (docs/backlog.md).
 */
export function ModuloEmConstrucao({ modulo, fase }: { modulo: string; fase: number }) {
  return (
    <EmptyState
      icone={Construction}
      titulo={`${modulo}: disponível a partir da Fase ${fase}`}
      descricao="Este módulo ainda não foi implementado. Nenhum dado é exibido aqui até que a funcionalidade esteja completa e testada de ponta a ponta."
    />
  );
}
