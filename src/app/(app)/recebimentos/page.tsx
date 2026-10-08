import type { Metadata } from "next";

import { ModuloEmConstrucao } from "@/components/layout/modulo-em-construcao";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Recebimentos" };

export default function RecebimentosPage() {
  return (
    <>
      <PageHeader
        titulo="Recebimentos"
        descricao="Entrada física de bens e lotes, com checklist e fotos."
      />
      <ModuloEmConstrucao modulo="Recebimentos" fase={5} />
    </>
  );
}
