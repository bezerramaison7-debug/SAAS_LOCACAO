import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AcaoConfirmada } from "@/components/forms/acao-confirmada";
import { AcaoSimples } from "@/components/forms/acao-simples";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { ROTULO_STATUS_MOVIMENTACAO, rotulo } from "@/features/locacoes/rotulos-eventos";
import {
  aceitarMovimentacao,
  aceiteAdministrativo,
  cancelarMovimentacao,
  recusarMovimentacao,
} from "@/features/movimentacoes/actions";
import { obterMovimentacao } from "@/features/movimentacoes/queries";
import { pode } from "@/lib/auth/autorizacao";
import { exigirContexto } from "@/lib/auth/contexto";
import { formatarDataHora } from "@/lib/format/datas";
import { formatarQuantidade } from "@/lib/format/moeda";
import { uuidSchema } from "@/lib/validation/comum";

export const metadata: Metadata = { title: "Movimentação" };

const AVISOS = {
  registrada: "Movimentação registrada.",
  aceita: "Movimentação aceita: local e responsável atualizados.",
  recusada: "Movimentação recusada: o item continua na origem.",
  cancelada: "Movimentação cancelada.",
} as const;

export default async function MovimentacaoPage({
  params,
  searchParams,
}: PageProps<"/movimentacoes/[id]">) {
  const contexto = await exigirContexto();
  const id = uuidSchema.safeParse((await params).id);
  const m = id.success ? await obterMovimentacao(contexto, id.data) : null;
  if (!m) notFound();
  const p = await searchParams;
  const aviso = (Object.keys(AVISOS) as (keyof typeof AVISOS)[]).find((k) => p[k]);
  const fuso = contexto.empresa.timezone;
  const pendente = m.status === "PENDENTE_ACEITE";
  const souDestinatario = m.novoResponsavelId === contexto.usuario.id;
  const admin = contexto.papel === "ADMIN";
  const podeCancelar =
    pendente &&
    (admin || (m.criadoPor === contexto.usuario.id && pode(contexto, "movimentacao.registrar")));
  const linkAlvo = m.bemId ? `/bens/${m.bemId}` : `/bens/lotes/${m.loteDestinoId ?? m.loteId}`;

  return (
    <>
      <PageHeader titulo={`Movimentação ${m.codigo}`} descricao={`${m.origem} → ${m.destino}`} />
      {aviso ? <Alert tom="sucesso" titulo={AVISOS[aviso]} className="mb-4" /> : null}
      {pendente && aviso === "registrada" ? (
        <Alert
          tom="alerta"
          titulo={`Aguardando o aceite de ${m.novoResponsavel}. Até lá, o item continua na origem.`}
          className="mb-4"
        />
      ) : null}
      <div className="mb-4">
        <Badge tom={pendente ? "alerta" : m.status === "CONFIRMADA" ? "sucesso" : "neutro"}>
          {rotulo(ROTULO_STATUS_MOVIMENTACAO, m.status)}
        </Badge>
      </div>
      <dl className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(
          [
            [
              "Item",
              <Link key="a" href={linkAlvo} className="text-primaria hover:underline">
                {m.alvo}
              </Link>,
            ],
            ["Quantidade", m.quantidade ? formatarQuantidade(m.quantidade) : "Bem inteiro"],
            ["Data da movimentação", formatarDataHora(m.dataEvento, fuso)],
            ["Responsável anterior", m.responsavelAnterior],
            ["Novo responsável", m.novoResponsavel],
            ["Motivo", m.motivo],
            ...(m.confirmadaEm ? [["Confirmada em", formatarDataHora(m.confirmadaEm, fuso)]] : []),
            ...(m.aceiteAdministrativo
              ? [["Aceite administrativo", m.justificativaAdministrativa ?? "—"]]
              : []),
            ...(m.recusadaEm
              ? [["Recusada", `${formatarDataHora(m.recusadaEm, fuso)} · ${m.motivoRecusa ?? ""}`]]
              : []),
            ...(m.canceladaEm ? [["Cancelada em", formatarDataHora(m.canceladaEm, fuso)]] : []),
            ...(m.corrige
              ? [
                  [
                    "Corrige",
                    <Link
                      key="c"
                      href={`/movimentacoes/${m.corrige}`}
                      className="text-primaria hover:underline"
                    >
                      movimentação anterior
                    </Link>,
                  ],
                ]
              : []),
          ] as [string, React.ReactNode][]
        ).map(([t, v]) => (
          <div key={t} className="rounded-md border border-borda bg-superficie p-3">
            <dt className="text-sm text-texto-suave">{t}</dt>
            <dd className="font-medium break-words">{v}</dd>
          </div>
        ))}
      </dl>
      {pendente ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          {souDestinatario ? (
            <>
              <AcaoSimples
                acao={aceitarMovimentacao}
                campos={{ id: m.id }}
                rotulo="Aceitar"
                pendente="Aceitando…"
              />
              <AcaoConfirmada
                acao={recusarMovimentacao}
                campos={{ id: m.id }}
                rotulo="Recusar"
                variante="secundaria"
                titulo="Recusar esta movimentação?"
                descricao="O item continua no local e com o responsável de origem."
                rotuloConfirmar="Recusar"
                motivo={{ rotulo: "Motivo da recusa" }}
              />
            </>
          ) : admin ? (
            <AcaoConfirmada
              acao={aceiteAdministrativo}
              campos={{ id: m.id }}
              rotulo="Aceite administrativo"
              titulo="Registrar aceite em nome do destinatário?"
              descricao={`Use apenas quando ${m.novoResponsavel} não puder aceitar. Fica registrado na auditoria com a justificativa.`}
              rotuloConfirmar="Registrar aceite"
              motivo={{ rotulo: "Justificativa" }}
            />
          ) : null}
          {podeCancelar ? (
            <AcaoConfirmada
              acao={cancelarMovimentacao}
              campos={{ id: m.id }}
              rotulo="Cancelar movimentação"
              variante="secundaria"
              perigoso
              titulo="Cancelar esta movimentação?"
              descricao="O item volta a estar em uso no local de origem."
              rotuloConfirmar="Cancelar movimentação"
              motivo={{ rotulo: "Motivo do cancelamento" }}
            />
          ) : null}
        </div>
      ) : null}
    </>
  );
}
