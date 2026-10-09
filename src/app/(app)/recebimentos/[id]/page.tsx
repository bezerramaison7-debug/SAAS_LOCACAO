import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { ConteudoEtapa } from "@/features/recebimentos/components/conteudo-etapa";
import { DetalheRecebimento } from "@/features/recebimentos/components/detalhe";
import { EtapasRecebimento } from "@/features/recebimentos/components/etapas";
import { StatusRecebimentoBadge } from "@/features/recebimentos/components/status-badge";
import { obterRecebimento } from "@/features/recebimentos/queries";
import { lerEtapaRecebimento, ROTULO_ETAPA_RECEBIMENTO } from "@/features/recebimentos/rotulos";
import { exigirPermissaoPagina, pode } from "@/lib/auth/autorizacao";
import { exigirContexto } from "@/lib/auth/contexto";
import { uuidSchema } from "@/lib/validation/comum";

export const metadata: Metadata = { title: "Recebimento" };

const AVISOS = {
  confirmado: {
    tom: "sucesso",
    texto: "Recebimento confirmado. Bens e lotes já constam no local informado.",
  },
  aguardando: {
    tom: "alerta",
    texto: "Quantidade acima do contratado: o recebimento aguarda autorização de Compras.",
  },
  descartado: { tom: "sucesso", texto: "Rascunho descartado." },
  cancelado: {
    tom: "sucesso",
    texto: "Recebimento cancelado. Bens e lotes dele foram cancelados.",
  },
} as const;

export default async function RecebimentoPage({
  params,
  searchParams,
}: PageProps<"/recebimentos/[id]">) {
  const contexto = await exigirContexto();
  exigirPermissaoPagina(contexto, "dados.ler_geral");
  const id = uuidSchema.safeParse((await params).id);
  const recebimento = id.success ? await obterRecebimento(contexto, id.data) : null;
  if (!recebimento) notFound();
  const p = await searchParams;
  const aviso = (Object.keys(AVISOS) as (keyof typeof AVISOS)[]).find((k) => p[k]);
  const emEdicao = recebimento.status === "RASCUNHO" && pode(contexto, "recebimento.registrar");
  const etapa = lerEtapaRecebimento(p.etapa);

  return (
    <>
      <PageHeader
        titulo={`Recebimento ${recebimento.codigo}`}
        descricao={`Locação ${recebimento.locacaoCodigo}${recebimento.fornecedor ? ` · ${recebimento.fornecedor}` : ""}`}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <StatusRecebimentoBadge status={recebimento.status} />
        <Link href={`/locacoes/${recebimento.locacaoId}`} className="text-primaria hover:underline">
          Ver locação
        </Link>
      </div>
      {aviso ? (
        <Alert tom={AVISOS[aviso].tom} titulo={AVISOS[aviso].texto} className="mb-4" />
      ) : null}
      {emEdicao ? (
        <>
          <EtapasRecebimento id={recebimento.id} atual={etapa} />
          <h2 className="mb-4 text-xl font-semibold">{ROTULO_ETAPA_RECEBIMENTO[etapa]}</h2>
          <ConteudoEtapa
            contexto={contexto}
            recebimento={recebimento}
            etapa={etapa}
            linhaSelecionada={typeof p.linha === "string" ? p.linha : undefined}
          />
        </>
      ) : (
        <DetalheRecebimento contexto={contexto} recebimento={recebimento} />
      )}
    </>
  );
}
