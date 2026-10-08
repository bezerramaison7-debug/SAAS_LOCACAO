import type { Metadata } from "next";

import { ModuloEmConstrucao } from "@/components/layout/modulo-em-construcao";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Bens e lotes" };

export default function BensPage() {
  return (
    <>
      <PageHeader
        titulo="Bens e lotes"
        descricao="Equipamentos individuais e quantidades controladas por lote."
      />
      <ModuloEmConstrucao modulo="Bens e lotes" fase={5} />
    </>
  );
}
