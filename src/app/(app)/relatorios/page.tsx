import type { Metadata } from "next";

import { ModuloEmConstrucao } from "@/components/layout/modulo-em-construcao";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Relatórios" };

export default function RelatoriosPage() {
  return (
    <>
      <PageHeader titulo="Relatórios" descricao="Relatórios em PDF com dados, evidências e hash." />
      <ModuloEmConstrucao modulo="Relatórios" fase={8} />
    </>
  );
}
