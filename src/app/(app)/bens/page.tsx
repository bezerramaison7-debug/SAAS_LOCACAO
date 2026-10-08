import { Package, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

import { DataTable } from "@/components/tables/data-table";
import { Pagination } from "@/components/tables/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { listarBens, listarLotes } from "@/features/bens/queries";
import { opcoesLocais } from "@/features/cadastros/locais/queries";
import { ROTULO_STATUS_BEM, ROTULO_STATUS_LOTE, rotulo } from "@/features/locacoes/rotulos-eventos";
import { exigirContexto } from "@/lib/auth/contexto";
import { formatarQuantidade } from "@/lib/format/moeda";
import { paginacaoSchema, uuidSchema } from "@/lib/validation/comum";

export const metadata: Metadata = { title: "Bens e lotes" };

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function BensPage({ searchParams }: PageProps<"/bens">) {
  const contexto = await exigirContexto();
  const p = await searchParams;
  const tipo = um(p.tipo) === "lotes" ? "lotes" : "bens";
  const filtros = {
    q: z
      .string()
      .trim()
      .max(80)
      .catch("")
      .parse(um(p.q) ?? ""),
    local: uuidSchema
      .nullable()
      .catch(null)
      .parse(um(p.local) ?? null),
    paginacao: paginacaoSchema.parse({ pagina: um(p.pagina), tamanho: um(p.tamanho) }),
  };
  const [locais, bens, lotes] = await Promise.all([
    opcoesLocais(contexto),
    tipo === "bens" ? listarBens(contexto, filtros) : null,
    tipo === "lotes" ? listarLotes(contexto, filtros) : null,
  ]);
  const total = bens?.total ?? lotes?.total ?? 0;

  return (
    <>
      <PageHeader
        titulo="Bens e lotes"
        descricao="Itens recebidos, com local e responsável atuais (último evento confirmado)."
      />
      <nav aria-label="Tipo de controle" className="mb-4 flex gap-1 border-b border-borda">
        {(["bens", "lotes"] as const).map((t) => (
          <Link
            key={t}
            href={t === "bens" ? "/bens" : "/bens?tipo=lotes"}
            aria-current={tipo === t ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center border-b-2 px-3 font-medium",
              tipo === t
                ? "border-primaria text-primaria"
                : "border-transparent text-texto-suave hover:text-texto",
            )}
          >
            {t === "bens" ? "Bens individuais" : "Lotes"}
          </Link>
        ))}
      </nav>
      <form
        method="get"
        role="search"
        className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        {tipo === "lotes" ? <input type="hidden" name="tipo" value="lotes" /> : null}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Label htmlFor="filtro-q">
            {tipo === "bens" ? "Código, série, placa ou patrimônio" : "Código do lote"}
          </Label>
          <Input id="filtro-q" name="q" type="search" defaultValue={filtros.q} />
        </div>
        <div className="flex flex-col gap-1.5 sm:w-64">
          <Label htmlFor="filtro-local">Local atual</Label>
          <Select id="filtro-local" name="local" defaultValue={filtros.local ?? ""}>
            <option value="">Todos</option>
            {locais.map((l) => (
              <option key={l.id} value={l.id}>
                {l.rotulo}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variante="secundaria">
          <Search aria-hidden /> Filtrar
        </Button>
      </form>
      {lotes ? (
        <DataTable
          legenda="Lotes"
          linhas={lotes.linhas}
          chaveLinha={(l) => l.id}
          vazio={
            <EmptyState
              icone={Package}
              titulo="Nenhum lote encontrado"
              descricao="Lotes nascem na confirmação do recebimento."
            />
          }
          colunas={[
            {
              chave: "codigo",
              titulo: "Lote",
              principal: true,
              render: (l) => (
                <Link
                  href={`/bens/lotes/${l.id}`}
                  className="font-mono font-medium text-primaria hover:underline"
                >
                  {l.codigo}
                </Link>
              ),
            },
            { chave: "saldo", titulo: "Saldo", render: (l) => formatarQuantidade(l.saldo) },
            {
              chave: "status",
              titulo: "Situação",
              render: (l) => <Badge>{rotulo(ROTULO_STATUS_LOTE, l.status)}</Badge>,
            },
            { chave: "local", titulo: "Local atual", render: (l) => l.local ?? "—" },
          ]}
        />
      ) : (
        <DataTable
          legenda="Bens individuais"
          linhas={bens?.linhas ?? []}
          chaveLinha={(b) => b.id}
          vazio={
            <EmptyState
              icone={Package}
              titulo="Nenhum bem encontrado"
              descricao="Bens passam a existir na confirmação do recebimento."
            />
          }
          colunas={[
            {
              chave: "codigo",
              titulo: "Bem",
              principal: true,
              render: (b) => (
                <Link
                  href={`/bens/${b.id}`}
                  className="font-mono font-medium text-primaria hover:underline"
                >
                  {b.codigo}
                </Link>
              ),
            },
            { chave: "ident", titulo: "Série/placa", render: (b) => b.identificacao ?? "—" },
            {
              chave: "status",
              titulo: "Situação",
              render: (b) => <Badge>{rotulo(ROTULO_STATUS_BEM, b.status)}</Badge>,
            },
            { chave: "local", titulo: "Local atual", render: (b) => b.local ?? "—" },
          ]}
        />
      )}
      <Pagination caminho="/bens" parametros={p} paginacao={filtros.paginacao} total={total} />
    </>
  );
}
