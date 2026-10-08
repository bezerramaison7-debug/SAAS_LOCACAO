import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { FormFornecedor } from "@/features/cadastros/fornecedores/components/form-fornecedor";
import { obterFornecedor } from "@/features/cadastros/fornecedores/queries";
import { exigirPermissaoPagina } from "@/lib/auth/autorizacao";
import { exigirContexto } from "@/lib/auth/contexto";
import { uuidSchema } from "@/lib/validation/comum";

export const metadata: Metadata = { title: "Editar fornecedor" };

export default async function EditarFornecedorPage({
  params,
}: PageProps<"/cadastros/fornecedores/[id]">) {
  const contexto = await exigirContexto();
  exigirPermissaoPagina(contexto, "fornecedor.gerenciar");
  const id = uuidSchema.safeParse((await params).id);
  const fornecedor = id.success ? await obterFornecedor(contexto, id.data) : null;
  if (!fornecedor) notFound();
  return (
    <>
      <PageHeader
        titulo={fornecedor.nomeFantasia ?? fornecedor.razaoSocial}
        descricao="Editar fornecedor"
      />
      <FormFornecedor fornecedor={fornecedor} />
    </>
  );
}
