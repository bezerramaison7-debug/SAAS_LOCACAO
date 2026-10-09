import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { FormCentroCusto } from "@/features/cadastros/centros-custo/components/form-centro-custo";
import { exigirPermissaoPagina } from "@/lib/auth/autorizacao";
import { exigirContexto } from "@/lib/auth/contexto";

export const metadata: Metadata = { title: "Novo centro de custo" };

export default async function NovoCentroCustoPage() {
  exigirPermissaoPagina(await exigirContexto(), "centro_custo.gerenciar");
  return (
    <>
      <PageHeader titulo="Novo centro de custo" />
      <FormCentroCusto />
    </>
  );
}
