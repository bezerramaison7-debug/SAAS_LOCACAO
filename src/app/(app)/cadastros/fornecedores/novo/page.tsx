import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { FormFornecedor } from "@/features/cadastros/fornecedores/components/form-fornecedor";
import { exigirPermissaoPagina } from "@/lib/auth/autorizacao";
import { exigirContexto } from "@/lib/auth/contexto";

export const metadata: Metadata = { title: "Novo fornecedor" };

export default async function NovoFornecedorPage() {
  exigirPermissaoPagina(await exigirContexto(), "fornecedor.gerenciar");
  return (
    <>
      <PageHeader titulo="Novo fornecedor" />
      <FormFornecedor />
    </>
  );
}
