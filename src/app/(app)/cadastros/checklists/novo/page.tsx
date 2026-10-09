import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { FormModelo } from "@/features/cadastros/checklists/components/form-modelo";
import { exigirPermissaoPagina } from "@/lib/auth/autorizacao";
import { exigirContexto } from "@/lib/auth/contexto";

export const metadata: Metadata = { title: "Novo checklist" };

export default async function NovoChecklistPage() {
  exigirPermissaoPagina(await exigirContexto(), "checklist.gerenciar");
  return (
    <>
      <PageHeader
        titulo="Novo checklist"
        descricao="O modelo nasce como rascunho (versão 1). Inclua as perguntas e publique."
      />
      <FormModelo />
    </>
  );
}
