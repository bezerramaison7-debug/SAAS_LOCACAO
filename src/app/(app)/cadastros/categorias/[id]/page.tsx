import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { FormCategoria } from "@/features/cadastros/categorias/components/form-categoria";
import { obterCategoria, opcoesFamiliasChecklist } from "@/features/cadastros/categorias/queries";
import { exigirPermissaoPagina } from "@/lib/auth/autorizacao";
import { exigirContexto } from "@/lib/auth/contexto";
import { uuidSchema } from "@/lib/validation/comum";

export const metadata: Metadata = { title: "Editar categoria" };

export default async function EditarCategoriaPage({
  params,
}: PageProps<"/cadastros/categorias/[id]">) {
  const contexto = await exigirContexto();
  exigirPermissaoPagina(contexto, "categoria.gerenciar");
  const id = uuidSchema.safeParse((await params).id);
  const [categoria, familias] = await Promise.all([
    id.success ? obterCategoria(contexto, id.data) : null,
    opcoesFamiliasChecklist(contexto),
  ]);
  if (!categoria) notFound();
  return (
    <>
      <PageHeader titulo={categoria.nome} descricao="Editar categoria" />
      <FormCategoria categoria={categoria} familias={familias} />
    </>
  );
}
