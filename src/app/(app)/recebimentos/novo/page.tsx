import type { Metadata } from "next";

import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { FormNovoRecebimento } from "@/features/recebimentos/components/form-novo";
import { locacoesParaReceber } from "@/features/recebimentos/queries";
import { exigirPermissaoPagina } from "@/lib/auth/autorizacao";
import { exigirContexto } from "@/lib/auth/contexto";

export const metadata: Metadata = { title: "Novo recebimento" };

export default async function NovoRecebimentoPage({
  searchParams,
}: PageProps<"/recebimentos/novo">) {
  const contexto = await exigirContexto();
  exigirPermissaoPagina(contexto, "recebimento.registrar");
  const locacoes = await locacoesParaReceber(contexto);
  const pedida = (await searchParams).locacao;
  return (
    <>
      <PageHeader
        titulo="Novo recebimento"
        descricao="Etapa 1 de 6 — escolha a locação. O rascunho é salvo a cada etapa."
      />
      {locacoes.length ? (
        <FormNovoRecebimento
          locacoes={locacoes}
          {...(typeof pedida === "string" ? { inicial: pedida } : {})}
        />
      ) : (
        <Alert tom="info" titulo="Não há locações ativas para receber itens." />
      )}
    </>
  );
}
