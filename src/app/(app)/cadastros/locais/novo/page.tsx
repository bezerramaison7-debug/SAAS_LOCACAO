import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { FormLocal } from "@/features/cadastros/locais/components/form-local";
import { exigirPermissaoPagina } from "@/lib/auth/autorizacao";
import { exigirContexto } from "@/lib/auth/contexto";

export const metadata: Metadata = { title: "Novo local" };

export default async function NovoLocalPage() {
  exigirPermissaoPagina(await exigirContexto(), "local.gerenciar");
  return (
    <>
      <PageHeader titulo="Novo local" />
      <FormLocal />
    </>
  );
}
