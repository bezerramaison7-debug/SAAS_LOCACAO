import type { Metadata } from "next";

import { ModuloEmConstrucao } from "@/components/layout/modulo-em-construcao";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Configurações" };

export default function ConfiguracoesPage() {
  return (
    <>
      <PageHeader titulo="Configurações" descricao="Empresa, usuários, papéis e preferências." />
      <ModuloEmConstrucao modulo="Configurações" fase={3} />
    </>
  );
}
