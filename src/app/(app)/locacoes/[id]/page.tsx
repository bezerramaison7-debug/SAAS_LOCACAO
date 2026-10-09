import { PackageCheck, Pencil, Receipt, Undo2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AcaoConfirmada } from "@/components/forms/acao-confirmada";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EstimativaLocacao } from "@/features/cobrancas/components/estimativa";
import { PainelEncerramentos } from "@/features/encerramentos/painel";
import { cancelarLocacao } from "@/features/locacoes/actions";
import { AbasLocacao, abasVisiveis, ROTULO_ABA } from "@/features/locacoes/components/abas";
import { ConteudoAba } from "@/features/locacoes/components/conteudo-aba";
import {
  StatusFinanceiroBadge,
  StatusLocacaoBadge,
} from "@/features/locacoes/components/status-badge";
import { obterLocacao } from "@/features/locacoes/queries";
import { lerAba } from "@/features/locacoes/schemas";
import { pode } from "@/lib/auth/autorizacao";
import { exigirContexto } from "@/lib/auth/contexto";
import { uuidSchema } from "@/lib/validation/comum";

export const metadata: Metadata = { title: "Locação" };

const AVISOS = {
  ativada: "Locação ativada. Os recebimentos já podem ser registrados.",
  cancelada: "Locação cancelada. O motivo ficou registrado no histórico.",
  desmobilizacao: "Desmobilização iniciada: a locação está em devolução.",
  encerrada_operacional: "Operação encerrada. O encerramento financeiro continua independente.",
  encerrada_financeiro: "Encerramento financeiro confirmado com a data informada.",
} as const;

export default async function LocacaoPage({ params, searchParams }: PageProps<"/locacoes/[id]">) {
  const contexto = await exigirContexto();
  const id = uuidSchema.safeParse((await params).id);
  // RLS: só retorna se o usuário pode ler esta locação na empresa ativa.
  const locacao = id.success ? await obterLocacao(contexto, id.data) : null;
  if (!locacao) notFound();
  const parametros = await searchParams;
  const visiveis = abasVisiveis(contexto);
  const pedida = lerAba(parametros.aba);
  const aba = visiveis.includes(pedida) ? pedida : "resumo";
  const aviso = (Object.keys(AVISOS) as (keyof typeof AVISOS)[]).find((k) => parametros[k]);

  const podeEditar = locacao.status === "RASCUNHO" && pode(contexto, "locacao.editar");
  const podeDevolver =
    (locacao.status === "ATIVA" || locacao.status === "EM_DEVOLUCAO") &&
    pode(contexto, "devolucao.gerenciar");
  const podeCobrar =
    ["ATIVA", "EM_DEVOLUCAO", "ENCERRADA_OPERACIONALMENTE"].includes(locacao.status) &&
    locacao.statusFinanceiro !== "ENCERRADO" &&
    pode(contexto, "cobranca.gerenciar");
  const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const podeCancelar =
    (locacao.status === "RASCUNHO" || locacao.status === "ATIVA") &&
    pode(contexto, "locacao.cancelar");

  return (
    <>
      <PageHeader
        titulo={`Locação ${locacao.codigo}`}
        descricao={locacao.fornecedor ?? "Fornecedor não informado"}
        acaoPrimaria={
          podeEditar ? (
            <Button asChild variante="primaria">
              <Link href={`/locacoes/${locacao.id}/editar?etapa=revisao`}>
                <Pencil aria-hidden /> Continuar preenchimento
              </Link>
            </Button>
          ) : locacao.status === "ATIVA" && pode(contexto, "recebimento.registrar") ? (
            <Button asChild variante="primaria">
              <Link href={`/recebimentos/novo?locacao=${locacao.id}`}>
                <PackageCheck aria-hidden /> Registrar recebimento
              </Link>
            </Button>
          ) : locacao.status === "EM_DEVOLUCAO" && podeDevolver ? (
            <Button asChild variante="primaria">
              <Link href={`/devolucoes/nova?locacao=${locacao.id}`}>
                <Undo2 aria-hidden /> Solicitar devolução
              </Link>
            </Button>
          ) : undefined
        }
      />
      {aviso ? <Alert tom="sucesso" titulo={AVISOS[aviso]} className="mb-4" /> : null}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <StatusLocacaoBadge status={locacao.status} />
          {locacao.status !== "RASCUNHO" && locacao.status !== "CANCELADA" ? (
            <StatusFinanceiroBadge status={locacao.statusFinanceiro} />
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {locacao.status === "ATIVA" && podeDevolver ? (
            <Button asChild variante="secundaria">
              <Link href={`/devolucoes/nova?locacao=${locacao.id}`}>
                <Undo2 aria-hidden /> Solicitar devolução
              </Link>
            </Button>
          ) : null}
          {podeCobrar ? (
            <Button asChild variante="secundaria">
              <Link href={`/cobrancas/nova?locacao=${locacao.id}`}>
                <Receipt aria-hidden /> Registrar cobrança
              </Link>
            </Button>
          ) : null}
          {podeCancelar ? (
            <AcaoConfirmada
              acao={cancelarLocacao}
              campos={{ id: locacao.id }}
              rotulo="Cancelar locação"
              variante="secundaria"
              perigoso
              titulo={`Cancelar a locação ${locacao.codigo}?`}
              descricao="Só é possível enquanto nenhum recebimento foi confirmado. Recebimentos em rascunho serão cancelados junto. Esta ação não pode ser desfeita."
              rotuloConfirmar="Cancelar locação"
              motivo={{ rotulo: "Motivo do cancelamento" }}
            />
          ) : null}
        </div>
      </div>
      {locacao.status !== "RASCUNHO" && locacao.status !== "CANCELADA" ? (
        <PainelEncerramentos contexto={contexto} locacao={locacao} />
      ) : null}
      <AbasLocacao locacaoId={locacao.id} atual={aba} visiveis={visiveis} />
      <section aria-label={ROTULO_ABA[aba]} className="pt-4">
        <ConteudoAba contexto={contexto} locacao={locacao} aba={aba} />
        {aba === "cobrancas" &&
        locacao.status !== "RASCUNHO" &&
        locacao.status !== "CANCELADA" &&
        pode(contexto, "cobranca.ver_estimativa") ? (
          <EstimativaLocacao
            contexto={contexto}
            locacaoId={locacao.id}
            inicioPadrao={locacao.inicioEfetivo}
            de={um(parametros.est_de)}
            ate={um(parametros.est_ate)}
          />
        ) : null}
      </section>
    </>
  );
}
