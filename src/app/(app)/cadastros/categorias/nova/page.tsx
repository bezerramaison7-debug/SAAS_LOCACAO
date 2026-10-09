import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { FormCategoria } from "@/features/cadastros/categorias/components/form-categoria";
import { opcoesFamiliasChecklist } from "@/features/cadastros/categorias/queries";
import { exigirPermissaoPagina } from "@/lib/auth/autorizacao";
import { exigirContexto } from "@/lib/auth/contexto";

export const metadata: Metadata = { title: "Nova categoria" };

export default async function NovaCategoriaPage() {
  const contexto = await exigirContexto();
  exigirPermissaoPagina(contexto, "categoria.gerenciar");
  return (
    <>
      <PageHeader titulo="Nova categoria" />
      <FormCategoria familias={await opcoesFamiliasChecklist(contexto)} />
    </>
  );
}
