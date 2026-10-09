import { AlertTriangle, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

import { DataTable } from "@/components/tables/data-table";
import { Pagination } from "@/components/tables/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { listarOcorrencias } from "@/features/ocorrencias/queries";
import {
  ROTULO_PRIORIDADE,
  ROTULO_STATUS_OCORRENCIA,
  ROTULO_TIPO_OCORRENCIA,
  TIPOS_OCORRENCIA,
  TOM_PRIORIDADE,
  vencida,
} from "@/features/ocorrencias/rotulos";
import { exigirContexto } from "@/lib/auth/contexto";
import { formatarDataHora } from "@/lib/format/datas";
import { paginacaoSchema } from "@/lib/validation/comum";

export const metadata: Metadata = { title: "Ocorrências" };

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const IDS_VISAO = ["EM_ABERTO", "VENCIDAS", "RESOLVIDA", "CANCELADA", "TODAS"] as const;
const ROTULO_VISAO: Record<(typeof IDS_VISAO)[number], string> = {
  EM_ABERTO: "Em aberto",
  VENCIDAS: "Vencidas",
  RESOLVIDA: "Resolvidas",
  CANCELADA: "Canceladas",
  TODAS: "Todas",
};

export default async function OcorrenciasPage({ searchParams }: PageProps<"/ocorrencias">) {
  const contexto = await exigirContexto();
  const p = await searchParams;
  const visao = z
    .enum(IDS_VISAO)
    .catch("EM_ABERTO")
    .parse(um(p.visao) ?? "EM_ABERTO");
  const filtros = {
    q: z
      .string()
      .trim()
      .max(80)
      .catch("")
      .parse(um(p.q) ?? ""),
    status:
      visao === "EM_ABERTO"
        ? ("EM_ABERTO" as const)
        : visao === "RESOLVIDA" || visao === "CANCELADA"
          ? visao
          : null,
    tipo: z
      .enum(TIPOS_OCORRENCIA)
      .nullable()
      .catch(null)
      .parse(um(p.tipo) ?? null),
    vencidas: visao === "VENCIDAS",
    paginacao: paginacaoSchema.parse({ pagina: um(p.pagina), tamanho: um(p.tamanho) }),
  };
  const { linhas, total } = await listarOcorrencias(contexto, filtros);
  const fuso = contexto.empresa.timezone;

  return (
    <>
      <PageHeader
        titulo="Ocorrências"
        descricao="Avarias, defeitos, extravios, divergências e trocas, com prazo e tratamento."
      />
      <nav aria-label="Visões" className="mb-3 flex flex-wrap gap-2">
        {IDS_VISAO.map((valor) => (
          <Link
            key={valor}
            href={`/ocorrencias?visao=${valor}`}
            aria-current={visao === valor ? "page" : undefined}
            className="flex min-h-11 items-center rounded-md border border-borda px-3 aria-[current=page]:border-primaria aria-[current=page]:text-primaria"
          >
            {ROTULO_VISAO[valor]}
          </Link>
        ))}
      </nav>
      <form
        method="get"
        role="search"
        className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <input type="hidden" name="visao" value={visao} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Label htmlFor="filtro-q">Código ou descrição</Label>
          <Input id="filtro-q" name="q" type="search" defaultValue={filtros.q} />
        </div>
        <div className="flex flex-col gap-1.5 sm:w-64">
          <Label htmlFor="filtro-tipo">Tipo</Label>
          <Select id="filtro-tipo" name="tipo" defaultValue={filtros.tipo ?? ""}>
            <option value="">Todos</option>
            {TIPOS_OCORRENCIA.map((t) => (
              <option key={t} value={t}>
                {ROTULO_TIPO_OCORRENCIA[t]}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variante="secundaria">
          <Search aria-hidden /> Filtrar
        </Button>
      </form>
      <DataTable
        legenda="Ocorrências"
        linhas={linhas}
        chaveLinha={(o) => o.id}
        vazio={
          <EmptyState
            icone={AlertTriangle}
            titulo="Nenhuma ocorrência nesta visão"
            descricao="Registre ocorrências a partir da ficha do bem, do lote ou da locação."
          />
        }
        colunas={[
          {
            chave: "codigo",
            titulo: "Ocorrência",
            principal: true,
            render: (o) => (
              <Link
                href={`/ocorrencias/${o.id}`}
                className="font-mono font-medium text-primaria hover:underline"
              >
                {o.codigo}
              </Link>
            ),
          },
          { chave: "tipo", titulo: "Tipo", render: (o) => ROTULO_TIPO_OCORRENCIA[o.tipo] },
          { chave: "alvo", titulo: "Bem/lote", render: (o) => o.alvo ?? `Locação ${o.locacao}` },
          {
            chave: "prioridade",
            titulo: "Prioridade",
            render: (o) => (
              <Badge tom={TOM_PRIORIDADE[o.prioridade]}>{ROTULO_PRIORIDADE[o.prioridade]}</Badge>
            ),
          },
          {
            chave: "status",
            titulo: "Situação",
            render: (o) => (
              <span className="flex flex-wrap gap-1">
                <Badge>{ROTULO_STATUS_OCORRENCIA[o.status]}</Badge>
                {vencida(o) ? <Badge tom="perigo">Vencida</Badge> : null}
              </span>
            ),
          },
          {
            chave: "prazo",
            titulo: "Prazo",
            render: (o) => (o.prazo ? formatarDataHora(o.prazo, fuso) : "—"),
          },
        ]}
      />
      <Pagination
        caminho="/ocorrencias"
        parametros={p}
        paginacao={filtros.paginacao}
        total={total}
      />
    </>
  );
}
