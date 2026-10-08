import type { Metadata } from "next";

import { ModuloEmConstrucao } from "@/components/layout/modulo-em-construcao";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Movimentações" };

export default function MovimentacoesPage() {
  return (
    <>
      <PageHeader titulo="Movimentações" descricao="Transferências de local e de responsável." />
      <ModuloEmConstrucao modulo="Movimentações" fase={6} />
    </>
  );
}
