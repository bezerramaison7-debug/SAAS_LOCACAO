import type { Metadata } from "next";

import { ModuloEmConstrucao } from "@/components/layout/modulo-em-construcao";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Locações" };

export default function LocacoesPage() {
  return (
    <>
      <PageHeader
        titulo="Locações"
        descricao="Contratos de locação vinculados aos pedidos do Sectra."
      />
      <ModuloEmConstrucao modulo="Locações" fase={4} />
    </>
  );
}
