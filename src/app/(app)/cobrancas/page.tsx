import { Plus, Receipt, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

import { DataTable } from "@/components/tables/data-table";
import { Pagination } from "@/components/tables/pagination";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import {
  listarCobrancas,
  pendenciasFinanceiras,
  VISOES_COBRANCA,
  type VisaoCobranca,
} from "@/features/cobrancas/queries";
import { ROTULO_STATUS_COBRANCA, rotulo } from "@/features/locacoes/rotulos-eventos";
import { exigirPermissaoPagina, pode } from "@/lib/auth/autorizacao";
import { exigirContexto } from "@/lib/auth/contexto";
import { formatarDataCivil, formatarDataHora } from "@/lib/format/datas";
import { formatarMoeda } from "@/lib/format/moeda";
import { paginacaoSchema } from "@/lib/validation/comum";

export const metadata: Metadata = { title: "Cobranças" };

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const IDS_VISAO = Object.keys(VISOES_COBRANCA) as [VisaoCobranca, ...VisaoCobranca[]];

export default async function CobrancasPage({ searchParams }: PageProps<"/cobrancas">) {
  const contexto = await exigirContexto();
  exigirPermissaoPagina(contexto, "valores.ver");
  const p = await searchParams;
  const pendencia = z
    .enum(["documento", "encerramento"])
    .nullable()
    .catch(null)
    .parse(um(p.pendencia) ?? null);
  const visao = z
    .enum(IDS_VISAO)
    .catch(pendencia ? "TODAS" : "PENDENTES")
    .parse(um(p.visao) ?? (pendencia ? "TODAS" : "PENDENTES"));
  const filtros = {
    q: z
      .string()
      .trim()
      .max(80)
      .catch("")
      .parse(um(p.q) ?? ""),
    visao,
    semDocumento: pendencia === "documento",
    paginacao: paginacaoSchema.parse({ pagina: um(p.pagina), tamanho: um(p.tamanho) }),
  };
  const [{ linhas, total }, pendencias] = await Promise.all([
    listarCobrancas(contexto, filtros),
    pendenciasFinanceiras(contexto),
  ]);
  const fuso = contexto.empresa.timezone;

  return (
    <>
      <PageHeader
        titulo="Cobranças"
        descricao="Documentos de cobrança do fornecedor, conferência e encerramento financeiro."
        acaoPrimaria={
          pode(contexto, "cobranca.gerenciar") ? (
            <Button asChild variante="primaria">
              <Link href="/cobrancas/nova">
                <Plus aria-hidden /> Registrar cobrança
              </Link>
            </Button>
          ) : undefined
        }
      />
      {pendencias.encerramentos.length || pendencias.ciencias.length ? (
        <section aria-labelledby="pendencias" className="mb-6 space-y-3">
          <h2 id="pendencias" className="text-xl font-semibold">
            Pendências do financeiro
          </h2>
          {pendencias.encerramentos.length ? (
            <Alert
              tom="alerta"
              titulo="Locações com saldo zerado aguardando encerramento financeiro"
            >
              <ul className="flex flex-wrap gap-x-4">
                {pendencias.encerramentos.map((l) => (
                  <li key={l.id}>
                    <Link
                      href={`/locacoes/${l.id}?aba=cobrancas`}
                      className="text-primaria underline"
                    >
                      {l.codigo}
                    </Link>
                  </li>
                ))}
              </ul>
            </Alert>
          ) : null}
          {pendencias.ciencias.length ? (
            <Alert tom="info" titulo="Devoluções retiradas aguardando ciência financeira">
              <ul className="space-y-1">
                {pendencias.ciencias.map((d) => (
                  <li key={d.id}>
                    <Link href={`/devolucoes/${d.id}`} className="text-primaria underline">
                      {d.codigo}
                    </Link>{" "}
                    · locação {d.locacao}
                    {d.retiradaEm ? ` · retirada em ${formatarDataHora(d.retiradaEm, fuso)}` : ""}
                  </li>
                ))}
              </ul>
            </Alert>
          ) : null}
        </section>
      ) : null}
      <nav aria-label="Visões" className="mb-3 flex flex-wrap gap-2">
        {IDS_VISAO.map((valor) => (
          <Link
            key={valor}
            href={`/cobrancas?visao=${valor}`}
            aria-current={visao === valor && !pendencia ? "page" : undefined}
            className="flex min-h-11 items-center rounded-md border border-borda px-3 aria-[current=page]:border-primaria aria-[current=page]:text-primaria"
          >
            {VISOES_COBRANCA[valor].rotulo}
          </Link>
        ))}
        <Link
          href="/cobrancas?pendencia=documento"
          aria-current={pendencia === "documento" ? "page" : undefined}
          className="flex min-h-11 items-center rounded-md border border-dashed border-borda px-3 aria-[current=page]:border-primaria aria-[current=page]:text-primaria"
        >
          Sem documento anexo
        </Link>
      </nav>
      <form
        method="get"
        role="search"
        className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <input type="hidden" name="visao" value={visao} />
        {pendencia ? <input type="hidden" name="pendencia" value={pendencia} /> : null}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Label htmlFor="filtro-q">Código ou número do documento</Label>
          <Input id="filtro-q" name="q" type="search" defaultValue={filtros.q} />
        </div>
        <Button type="submit" variante="secundaria">
          <Search aria-hidden /> Filtrar
        </Button>
      </form>
      <DataTable
        legenda="Cobranças"
        linhas={linhas}
        chaveLinha={(c) => c.id}
        vazio={
          <EmptyState
            icone={Receipt}
            titulo="Nenhuma cobrança nesta visão"
            descricao="Cobranças do fornecedor são lançadas pelo Financeiro."
          />
        }
        colunas={[
          {
            chave: "codigo",
            titulo: "Cobrança",
            principal: true,
            render: (c) => (
              <Link
                href={`/cobrancas/${c.id}`}
                className="font-mono font-medium text-primaria hover:underline"
              >
                {c.codigo}
              </Link>
            ),
          },
          {
            chave: "locacao",
            titulo: "Locação",
            render: (c) => (
              <Link href={`/locacoes/${c.locacaoId}`} className="text-primaria hover:underline">
                {c.locacao}
              </Link>
            ),
          },
          {
            chave: "competencia",
            titulo: "Competência",
            render: (c) =>
              `${formatarDataCivil(c.competenciaInicio)} a ${formatarDataCivil(c.competenciaFim)}`,
          },
          { chave: "valor", titulo: "Valor cobrado", render: (c) => formatarMoeda(c.valor) },
          { chave: "documento", titulo: "Documento", render: (c) => c.documento ?? "—" },
          {
            chave: "status",
            titulo: "Situação",
            render: (c) => (
              <Badge
                tom={
                  c.status === "DIVERGENTE"
                    ? "perigo"
                    : c.status === "PENDENTE"
                      ? "alerta"
                      : "sucesso"
                }
              >
                {rotulo(ROTULO_STATUS_COBRANCA, c.status)}
              </Badge>
            ),
          },
        ]}
      />
      <Pagination caminho="/cobrancas" parametros={p} paginacao={filtros.paginacao} total={total} />
    </>
  );
}
