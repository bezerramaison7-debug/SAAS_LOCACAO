import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { FormLocal } from "@/features/cadastros/locais/components/form-local";
import { obterLocal } from "@/features/cadastros/locais/queries";
import { exigirPermissaoPagina } from "@/lib/auth/autorizacao";
import { exigirContexto } from "@/lib/auth/contexto";
import { uuidSchema } from "@/lib/validation/comum";

export const metadata: Metadata = { title: "Editar local" };

export default async function EditarLocalPage({ params }: PageProps<"/cadastros/locais/[id]">) {
  const contexto = await exigirContexto();
  exigirPermissaoPagina(contexto, "local.gerenciar");
  const id = uuidSchema.safeParse((await params).id);
  const local = id.success ? await obterLocal(contexto, id.data) : null;
  if (!local) notFound();
  return (
    <>
      <PageHeader titulo={local.nome} descricao="Editar local" />
      <FormLocal local={local} />
    </>
  );
}
