import { Landmark, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DataTable } from "@/components/tables/data-table";
import { Pagination } from "@/components/tables/pagination";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { listarCentrosCusto, type CentroCusto } from "@/features/cadastros/centros-custo/queries";
import { lerFiltrosCadastro } from "@/features/cadastros/comum";
import { BarraFiltros } from "@/features/cadastros/components/barra-filtros";
import { SituacaoBadge } from "@/features/cadastros/components/situacao-badge";
import { exigirPermissaoPagina, pode } from "@/lib/auth/autorizacao";
import { exigirContexto } from "@/lib/auth/contexto";

export const metadata: Metadata = { title: "Centros de custo" };

export default async function CentrosCustoPage({
  searchParams,
}: PageProps<"/cadastros/centros-custo">) {
  const contexto = await exigirContexto();
  exigirPermissaoPagina(contexto, "dados.ler_geral");
  const parametros = await searchParams;
  const filtros = lerFiltrosCadastro(parametros);
  const { linhas, total } = await listarCentrosCusto(contexto, filtros);
  const podeEditar = pode(contexto, "centro_custo.gerenciar");

  return (
    <>
      <PageHeader
        titulo="Centros de custo"
        descricao="Apropriação contábil das locações."
        acaoPrimaria={
          podeEditar ? (
            <Button asChild variante="primaria">
              <Link href="/cadastros/centros-custo/novo">
                <Plus aria-hidden /> Novo centro de custo
              </Link>
            </Button>
          ) : undefined
        }
      />
      {parametros.salvo ? (
        <Alert tom="sucesso" titulo="Centro de custo salvo." className="mb-4" />
      ) : null}
      <BarraFiltros filtros={filtros} rotuloBusca="Buscar por código ou nome" />
      <DataTable<CentroCusto>
        legenda="Centros de custo"
        linhas={linhas}
        chaveLinha={(c) => c.id}
        vazio={
          <EmptyState
            icone={Landmark}
            titulo="Nenhum centro de custo encontrado"
            descricao={
              filtros.q ? "Ajuste a busca ou a situação." : "Cadastre o primeiro centro de custo."
            }
          />
        }
        colunas={[
          {
            chave: "codigo",
            titulo: "Código",
            principal: true,
            render: (c) =>
              podeEditar ? (
                <Link
                  href={`/cadastros/centros-custo/${c.id}`}
                  className="font-mono font-medium text-primaria hover:underline"
                >
                  {c.codigo}
                </Link>
              ) : (
                <span className="font-mono font-medium">{c.codigo}</span>
              ),
          },
          { chave: "nome", titulo: "Nome", render: (c) => c.nome },
          {
            chave: "situacao",
            titulo: "Situação",
            render: (c) => <SituacaoBadge ativo={c.ativo} />,
          },
        ]}
      />
      <Pagination
        caminho="/cadastros/centros-custo"
        parametros={parametros}
        paginacao={filtros.paginacao}
        total={total}
      />
    </>
  );
}
