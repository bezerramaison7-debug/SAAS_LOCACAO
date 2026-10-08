import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { FormCentroCusto } from "@/features/cadastros/centros-custo/components/form-centro-custo";
import { obterCentroCusto } from "@/features/cadastros/centros-custo/queries";
import { exigirPermissaoPagina } from "@/lib/auth/autorizacao";
import { exigirContexto } from "@/lib/auth/contexto";
import { uuidSchema } from "@/lib/validation/comum";

export const metadata: Metadata = { title: "Editar centro de custo" };

export default async function EditarCentroCustoPage({
  params,
}: PageProps<"/cadastros/centros-custo/[id]">) {
  const contexto = await exigirContexto();
  exigirPermissaoPagina(contexto, "centro_custo.gerenciar");
  const id = uuidSchema.safeParse((await params).id);
  const centro = id.success ? await obterCentroCusto(contexto, id.data) : null;
  if (!centro) notFound();
  return (
    <>
      <PageHeader titulo={`${centro.codigo} — ${centro.nome}`} descricao="Editar centro de custo" />
      <FormCentroCusto centro={centro} />
    </>
  );
}
