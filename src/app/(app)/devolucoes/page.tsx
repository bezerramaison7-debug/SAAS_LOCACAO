import type { Metadata } from "next";

import { ModuloEmConstrucao } from "@/components/layout/modulo-em-construcao";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Devoluções" };

export default function DevolucoesPage() {
  return (
    <>
      <PageHeader
        titulo="Devoluções"
        descricao="Solicitação, agendamento, retirada e conferência."
      />
      <ModuloEmConstrucao modulo="Devoluções" fase={7} />
    </>
  );
}
