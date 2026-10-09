import { ArrowLeftRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

import { AcaoConfirmada } from "@/components/forms/acao-confirmada";
import { AcaoSimples } from "@/components/forms/acao-simples";
import { DataTable } from "@/components/tables/data-table";
import { Pagination } from "@/components/tables/pagination";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ROTULO_STATUS_MOVIMENTACAO, rotulo } from "@/features/locacoes/rotulos-eventos";
import { aceitarMovimentacao, recusarMovimentacao } from "@/features/movimentacoes/actions";
import { aguardandoMeuAceite, listarMovimentacoes } from "@/features/movimentacoes/queries";
import { exigirContexto } from "@/lib/auth/contexto";
import { formatarDataHora } from "@/lib/format/datas";
import { formatarQuantidade } from "@/lib/format/moeda";
import { paginacaoSchema } from "@/lib/validation/comum";

export const metadata: Metadata = { title: "Movimentações" };

const STATUS = ["PENDENTE_ACEITE", "CONFIRMADA", "RECUSADA", "CANCELADA"] as const;
const TOM = {
  PENDENTE_ACEITE: "alerta",
  CONFIRMADA: "sucesso",
  RECUSADA: "perigo",
  CANCELADA: "neutro",
} as const;
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function MovimentacoesPage({ searchParams }: PageProps<"/movimentacoes">) {
  const contexto = await exigirContexto();
  const p = await searchParams;
  const filtros = {
    status: z
      .enum(STATUS)
      .nullable()
      .catch(null)
      .parse(um(p.status) ?? null),
    paginacao: paginacaoSchema.parse({ pagina: um(p.pagina), tamanho: um(p.tamanho) }),
  };
  const [pendentes, { linhas, total }] = await Promise.all([
    aguardandoMeuAceite(contexto),
    listarMovimentacoes(contexto, filtros),
  ]);
  const fuso = contexto.empresa.timezone;

  return (
    <>
      <PageHeader
        titulo="Movimentações"
        descricao="Transferências de local e de responsável. Confirmadas são imutáveis."
      />
      {pendentes.length ? (
        <section aria-labelledby="aceite" className="mb-6 space-y-3">
          <h2 id="aceite" className="text-xl font-semibold">
            Aguardando o seu aceite ({pendentes.length})
          </h2>
          <ul className="space-y-3">
            {pendentes.map((m) => (
              <li
                key={m.id}
                className="space-y-3 rounded-md border border-alerta bg-superficie p-4"
              >
                <div>
                  <Link
                    href={`/movimentacoes/${m.id}`}
                    className="font-semibold text-primaria hover:underline"
                  >
                    {m.alvo}
                    {m.quantidade ? ` · ${formatarQuantidade(m.quantidade)}` : ""}
                  </Link>
                  <p>
                    {m.origem} → {m.destino}
                  </p>
                  <p className="text-sm text-texto-suave">
                    Enviado por {m.responsavelAnterior} em {formatarDataHora(m.dataEvento, fuso)} ·{" "}
                    {m.motivo}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
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
                    titulo={`Recusar ${m.alvo}?`}
                    descricao="O item continua no local e com o responsável de origem."
                    rotuloConfirmar="Recusar"
                    motivo={{ rotulo: "Motivo da recusa" }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <nav aria-label="Filtrar por situação" className="mb-4 flex flex-wrap gap-2">
        {[["", "Todas"], ...STATUS.map((s) => [s, ROTULO_STATUS_MOVIMENTACAO[s] ?? s])].map(
          ([valor, r]) => (
            <Link
              key={valor}
              href={valor ? `/movimentacoes?status=${valor}` : "/movimentacoes"}
              aria-current={(filtros.status ?? "") === valor ? "page" : undefined}
              className="flex min-h-11 items-center rounded-md border border-borda px-3 aria-[current=page]:border-primaria aria-[current=page]:text-primaria"
            >
              {r}
            </Link>
          ),
        )}
      </nav>
      <DataTable
        legenda="Movimentações"
        linhas={linhas}
        chaveLinha={(m) => m.id}
        vazio={
          <EmptyState
            icone={ArrowLeftRight}
            titulo="Nenhuma movimentação"
            descricao="Movimente um bem ou lote a partir da ficha dele."
          />
        }
        colunas={[
          {
            chave: "codigo",
            titulo: "Movimentação",
            principal: true,
            render: (m) => (
              <Link
                href={`/movimentacoes/${m.id}`}
                className="font-mono font-medium text-primaria hover:underline"
              >
                {m.codigo}
              </Link>
            ),
          },
          {
            chave: "alvo",
            titulo: "Bem/lote",
            render: (m) =>
              `${m.alvo}${m.quantidade ? ` · ${formatarQuantidade(m.quantidade)}` : ""}`,
          },
          {
            chave: "trajeto",
            titulo: "Origem → destino",
            render: (m) => `${m.origem} → ${m.destino}`,
          },
          { chave: "resp", titulo: "Novo responsável", render: (m) => m.novoResponsavel },
          { chave: "data", titulo: "Data", render: (m) => formatarDataHora(m.dataEvento, fuso) },
          {
            chave: "status",
            titulo: "Situação",
            render: (m) => (
              <Badge tom={TOM[m.status]}>{rotulo(ROTULO_STATUS_MOVIMENTACAO, m.status)}</Badge>
            ),
          },
        ]}
      />
      <Pagination
        caminho="/movimentacoes"
        parametros={p}
        paginacao={filtros.paginacao}
        total={total}
      />
    </>
  );
}
