import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { opcoesCentrosCusto } from "@/features/cadastros/centros-custo/queries";
import { opcoesFornecedores } from "@/features/cadastros/fornecedores/queries";
import { EtapasLocacao } from "@/features/locacoes/components/etapas";
import { FormIdentificacao } from "@/features/locacoes/components/form-identificacao";
import { exigirPermissaoPagina } from "@/lib/auth/autorizacao";
import { exigirContexto } from "@/lib/auth/contexto";

export const metadata: Metadata = { title: "Nova locação" };

export default async function NovaLocacaoPage() {
  const contexto = await exigirContexto();
  exigirPermissaoPagina(contexto, "locacao.criar");
  const [fornecedores, centros] = await Promise.all([
    opcoesFornecedores(contexto),
    opcoesCentrosCusto(contexto),
  ]);
  return (
    <>
      <PageHeader
        titulo="Nova locação"
        descricao="Comece pela identificação; a locação fica em rascunho até ser ativada."
      />
      <EtapasLocacao atual="identificacao" />
      <FormIdentificacao fornecedores={fornecedores} centros={centros} />
    </>
  );
}
