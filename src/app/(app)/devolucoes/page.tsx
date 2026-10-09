import { Search, Undo2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

import { DataTable } from "@/components/tables/data-table";
import { Pagination } from "@/components/tables/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { listarDevolucoes, VISOES_DEVOLUCAO } from "@/features/devolucoes/queries";
import { ROTULO_STATUS_DEVOLUCAO, rotulo } from "@/features/locacoes/rotulos-eventos";
import { exigirPermissaoPagina } from "@/lib/auth/autorizacao";
import { exigirContexto } from "@/lib/auth/contexto";
import { formatarDataHora } from "@/lib/format/datas";
import { paginacaoSchema } from "@/lib/validation/comum";

export const metadata: Metadata = { title: "Devoluções" };

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const IDS_VISAO = Object.keys(VISOES_DEVOLUCAO) as (keyof typeof VISOES_DEVOLUCAO)[];
const PENDENCIAS = { comprovante: "Sem comprovante", ciencia: "Sem ciência financeira" } as const;

export default async function DevolucoesPage({ searchParams }: PageProps<"/devolucoes">) {
  const contexto = await exigirContexto();
  exigirPermissaoPagina(contexto, "dados.ler_geral");
  const p = await searchParams;
  const pendencia = z
    .enum(["comprovante", "ciencia"])
    .nullable()
    .catch(null)
    .parse(um(p.pendencia) ?? null);
  const visao = z
    .enum(IDS_VISAO as [keyof typeof VISOES_DEVOLUCAO, ...(keyof typeof VISOES_DEVOLUCAO)[]])
    .catch(pendencia ? "TODAS" : "ABERTAS")
    .parse(um(p.visao) ?? (pendencia ? "TODAS" : "ABERTAS"));
  const filtros = {
    q: z
      .string()
      .trim()
      .max(80)
      .catch("")
      .parse(um(p.q) ?? ""),
    visao,
    pendencia,
    paginacao: paginacaoSchema.parse({ pagina: um(p.pagina), tamanho: um(p.tamanho) }),
  };
  const { linhas, total } = await listarDevolucoes(contexto, filtros);
  const fuso = contexto.empresa.timezone;
  const data = (v: string | null) => (v ? formatarDataHora(v, fuso) : "—");

  return (
    <>
      <PageHeader
        titulo="Devoluções"
        descricao="Solicitação, agendamento, retirada e conferência. Para solicitar, abra a locação."
      />
      <nav aria-label="Visões" className="mb-3 flex flex-wrap gap-2">
        {IDS_VISAO.map((valor) => (
          <Link
            key={valor}
            href={`/devolucoes?visao=${valor}`}
            aria-current={visao === valor && !pendencia ? "page" : undefined}
            className="flex min-h-11 items-center rounded-md border border-borda px-3 aria-[current=page]:border-primaria aria-[current=page]:text-primaria"
          >
            {VISOES_DEVOLUCAO[valor].rotulo}
          </Link>
        ))}
        {(Object.keys(PENDENCIAS) as (keyof typeof PENDENCIAS)[]).map((valor) => (
          <Link
            key={valor}
            href={`/devolucoes?pendencia=${valor}`}
            aria-current={pendencia === valor ? "page" : undefined}
            className="flex min-h-11 items-center rounded-md border border-dashed border-borda px-3 aria-[current=page]:border-primaria aria-[current=page]:text-primaria"
          >
            {PENDENCIAS[valor]}
          </Link>
        ))}
      </nav>
      <form
        method="get"
        role="search"
        className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <input type="hidden" name="visao" value={visao} />
        {pendencia ? <input type="hidden" name="pendencia" value={pendencia} /> : null}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Label htmlFor="filtro-q">Código ou recebedor</Label>
          <Input id="filtro-q" name="q" type="search" defaultValue={filtros.q} />
        </div>
        <Button type="submit" variante="secundaria">
          <Search aria-hidden /> Filtrar
        </Button>
      </form>
      <DataTable
        legenda="Devoluções"
        linhas={linhas}
        chaveLinha={(d) => d.id}
        vazio={
          <EmptyState
            icone={Undo2}
            titulo="Nenhuma devolução nesta visão"
            descricao="Devoluções são solicitadas na página da locação."
          />
        }
        colunas={[
          {
            chave: "codigo",
            titulo: "Devolução",
            principal: true,
            render: (d) => (
              <Link
                href={`/devolucoes/${d.id}`}
                className="font-mono font-medium text-primaria hover:underline"
              >
                {d.codigo}
              </Link>
            ),
          },
          {
            chave: "locacao",
            titulo: "Locação",
            render: (d) => (
              <Link href={`/locacoes/${d.locacaoId}`} className="text-primaria hover:underline">
                {d.locacao}
              </Link>
            ),
          },
          {
            chave: "status",
            titulo: "Situação",
            render: (d) => (
              <span className="flex flex-wrap gap-1">
                <Badge>{rotulo(ROTULO_STATUS_DEVOLUCAO, d.status)}</Badge>
                {d.retiradaEm && !d.ciencia ? <Badge tom="alerta">Sem ciência</Badge> : null}
              </span>
            ),
          },
          { chave: "solicitada", titulo: "Solicitada em", render: (d) => data(d.solicitadaEm) },
          { chave: "agendada", titulo: "Agendada para", render: (d) => data(d.agendadaPara) },
          { chave: "retirada", titulo: "Retirada em", render: (d) => data(d.retiradaEm) },
        ]}
      />
      <Pagination
        caminho="/devolucoes"
        parametros={p}
        paginacao={filtros.paginacao}
        total={total}
      />
    </>
  );
}
