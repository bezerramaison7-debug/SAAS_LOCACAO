import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { FormSolicitacao } from "@/features/devolucoes/components/form-solicitacao";
import { opcoesDevolucao } from "@/features/devolucoes/queries";
import { obterLocacao } from "@/features/locacoes/queries";
import { exigirPermissaoPagina } from "@/lib/auth/autorizacao";
import { exigirContexto } from "@/lib/auth/contexto";
import { uuidSchema } from "@/lib/validation/comum";

export const metadata: Metadata = { title: "Solicitar devolução" };

export default async function NovaDevolucaoPage({ searchParams }: PageProps<"/devolucoes/nova">) {
  const contexto = await exigirContexto();
  exigirPermissaoPagina(contexto, "devolucao.gerenciar");
  const bruto = (await searchParams).locacao;
  const id = uuidSchema.safeParse(Array.isArray(bruto) ? bruto[0] : bruto);
  const locacao = id.success ? await obterLocacao(contexto, id.data) : null;
  if (!locacao) notFound();
  const ativa = locacao.status === "ATIVA" || locacao.status === "EM_DEVOLUCAO";
  const opcoes = ativa ? await opcoesDevolucao(contexto, locacao.id) : { bens: [], lotes: [] };
  return (
    <>
      <PageHeader
        titulo={`Solicitar devolução — ${locacao.codigo}`}
        descricao="Escolha os bens e as quantidades de lote que voltam ao fornecedor."
      />
      {!ativa ? (
        <Alert tom="alerta" titulo="Só locação ativa ou em devolução aceita devolução." />
      ) : !opcoes.bens.length && !opcoes.lotes.length ? (
        <Alert tom="info" titulo="Nada disponível para devolver" className="max-w-3xl">
          Todos os itens já estão em devoluções abertas, em transferência, em manutenção ou foram
          devolvidos.{" "}
          <Link href={`/locacoes/${locacao.id}?aba=devolucoes`} className="text-primaria underline">
            Ver devoluções da locação
          </Link>
        </Alert>
      ) : (
        <FormSolicitacao locacaoId={locacao.id} bens={opcoes.bens} lotes={opcoes.lotes} />
      )}
    </>
  );
}
