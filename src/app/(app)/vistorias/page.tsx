import type { Metadata } from "next";

import { ModuloEmConstrucao } from "@/components/layout/modulo-em-construcao";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Vistorias" };

export default function VistoriasPage() {
  return (
    <>
      <PageHeader
        titulo="Vistorias"
        descricao="Checklists preenchidos em recebimentos, devoluções e inspeções."
      />
      <ModuloEmConstrucao modulo="Vistorias" fase={5} />
    </>
  );
}
