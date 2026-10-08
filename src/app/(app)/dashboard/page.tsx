import type { Metadata } from "next";

import { ModuloEmConstrucao } from "@/components/layout/modulo-em-construcao";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Painel" };

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        titulo="Painel"
        descricao="Indicadores operacionais e financeiros com regra de cálculo explícita."
      />
      <ModuloEmConstrucao modulo="Painel" fase={8} />
    </>
  );
}
