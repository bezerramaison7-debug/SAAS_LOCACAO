import type { Metadata } from "next";

import { ModuloEmConstrucao } from "@/components/layout/modulo-em-construcao";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Ocorrências" };

export default function OcorrenciasPage() {
  return (
    <>
      <PageHeader
        titulo="Ocorrências"
        descricao="Avarias, defeitos, extravios, trocas e divergências."
      />
      <ModuloEmConstrucao modulo="Ocorrências" fase={6} />
    </>
  );
}
