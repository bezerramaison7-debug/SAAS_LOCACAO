import type { Metadata } from "next";

import { ModuloEmConstrucao } from "@/components/layout/modulo-em-construcao";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Cobranças" };

export default function CobrancasPage() {
  return (
    <>
      <PageHeader
        titulo="Cobranças"
        descricao="Conferência de cobranças e encerramento financeiro."
      />
      <ModuloEmConstrucao modulo="Cobranças" fase={7} />
    </>
  );
}
