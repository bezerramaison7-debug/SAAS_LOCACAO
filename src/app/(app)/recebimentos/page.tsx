import { PackageCheck, Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

import { DataTable } from "@/components/tables/data-table";
import { Pagination } from "@/components/tables/pagination";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { ROTULO_STATUS_RECEBIMENTO } from "@/features/locacoes/rotulos-eventos";
import { StatusRecebimentoBadge } from "@/features/recebimentos/components/status-badge";
import { listarRecebimentos } from "@/features/recebimentos/queries";
import { STATUS_RECEBIMENTO } from "@/features/recebimentos/rotulos";
import { exigirPermissaoPagina, pode } from "@/lib/auth/autorizacao";
import { exigirContexto } from "@/lib/auth/contexto";
import { formatarDataHora } from "@/lib/format/datas";
import { paginacaoSchema } from "@/lib/validation/comum";

export const metadata: Metadata = { title: "Recebimentos" };

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function RecebimentosPage({ searchParams }: PageProps<"/recebimentos">) {
  const contexto = await exigirContexto();
  exigirPermissaoPagina(contexto, "dados.ler_geral");
  const p = await searchParams;
  const filtros = {
    q: z
      .string()
      .trim()
      .max(60)
      .catch("")
      .parse(um(p.q) ?? ""),
    status: z
      .enum(STATUS_RECEBIMENTO)
      .nullable()
      .catch(null)
      .parse(um(p.status) ?? null),
    paginacao: paginacaoSchema.parse({ pagina: um(p.pagina), tamanho: um(p.tamanho) }),
  };
  const { linhas, total } = await listarRecebimentos(contexto, filtros);
  const fuso = contexto.empresa.timezone;

  return (
    <>
      <PageHeader
        titulo="Recebimentos"
        descricao="Entrada física de bens e lotes, com checklist e fotos."
        acaoPrimaria={
          pode(contexto, "recebimento.registrar") ? (
            <Button asChild variante="primaria">
              <Link href="/recebimentos/novo">
                <Plus aria-hidden /> Novo recebimento
              </Link>
            </Button>
          ) : undefined
        }
      />
      <form
        method="get"
        role="search"
        className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Label htmlFor="filtro-q">Buscar pelo código</Label>
          <Input id="filtro-q" name="q" type="search" defaultValue={filtros.q} />
        </div>
        <div className="flex flex-col gap-1.5 sm:w-56">
          <Label htmlFor="filtro-status">Situação</Label>
          <Select id="filtro-status" name="status" defaultValue={filtros.status ?? ""}>
            <option value="">Todas</option>
            {STATUS_RECEBIMENTO.map((s) => (
              <option key={s} value={s}>
                {ROTULO_STATUS_RECEBIMENTO[s]}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variante="secundaria">
          <Search aria-hidden /> Filtrar
        </Button>
      </form>
      <DataTable
        legenda="Recebimentos"
        linhas={linhas}
        chaveLinha={(r) => r.id}
        vazio={
          <EmptyState
            icone={PackageCheck}
            titulo="Nenhum recebimento encontrado"
            descricao="Recebimentos são registrados para locações ativas."
          />
        }
        colunas={[
          {
            chave: "codigo",
            titulo: "Recebimento",
            principal: true,
            render: (r) => (
              <Link
                href={`/recebimentos/${r.id}`}
                className="font-mono font-medium text-primaria hover:underline"
              >
                {r.codigo}
              </Link>
            ),
          },
          {
            chave: "status",
            titulo: "Situação",
            render: (r) => <StatusRecebimentoBadge status={r.status} />,
          },
          { chave: "locacao", titulo: "Locação", render: (r) => r.locacao },
          {
            chave: "data",
            titulo: "Data do recebimento",
            render: (r) => (r.dataEvento ? formatarDataHora(r.dataEvento, fuso) : "—"),
          },
          { chave: "local", titulo: "Local", render: (r) => r.local ?? "—" },
        ]}
      />
      <Pagination
        caminho="/recebimentos"
        parametros={p}
        paginacao={filtros.paginacao}
        total={total}
      />
    </>
  );
}
