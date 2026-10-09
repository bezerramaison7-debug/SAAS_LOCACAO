import { Plus, Shapes } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DataTable } from "@/components/tables/data-table";
import { Pagination } from "@/components/tables/pagination";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { listarCategorias, type Categoria } from "@/features/cadastros/categorias/queries";
import { lerFiltrosCadastro } from "@/features/cadastros/comum";
import { BarraFiltros } from "@/features/cadastros/components/barra-filtros";
import { SituacaoBadge } from "@/features/cadastros/components/situacao-badge";
import { exigirPermissaoPagina, pode } from "@/lib/auth/autorizacao";
import { exigirContexto } from "@/lib/auth/contexto";

export const metadata: Metadata = { title: "Categorias de bem" };

function exigencias(c: Categoria): string {
  const lista = [
    c.exigeNumeroSerie && "nº de série",
    c.exigePlaca && "placa",
    c.exigeIdentFornecedor && "patrimônio do fornecedor",
    c.exigeVistoriaSaida && "vistoria na devolução",
  ].filter(Boolean);
  return lista.length ? lista.join(", ") : "—";
}

export default async function CategoriasPage({ searchParams }: PageProps<"/cadastros/categorias">) {
  const contexto = await exigirContexto();
  exigirPermissaoPagina(contexto, "dados.ler_geral");
  const parametros = await searchParams;
  const filtros = lerFiltrosCadastro(parametros);
  const { linhas, total } = await listarCategorias(contexto, filtros);
  const podeEditar = pode(contexto, "categoria.gerenciar");

  return (
    <>
      <PageHeader
        titulo="Categorias de bem"
        descricao="Definem se os bens são controlados individualmente ou por lote."
        acaoPrimaria={
          podeEditar ? (
            <Button asChild variante="primaria">
              <Link href="/cadastros/categorias/nova">
                <Plus aria-hidden /> Nova categoria
              </Link>
            </Button>
          ) : undefined
        }
      />
      {parametros.salvo ? <Alert tom="sucesso" titulo="Categoria salva." className="mb-4" /> : null}
      <BarraFiltros filtros={filtros} rotuloBusca="Buscar por nome" />
      <DataTable<Categoria>
        legenda="Categorias de bem"
        linhas={linhas}
        chaveLinha={(c) => c.id}
        vazio={
          <EmptyState
            icone={Shapes}
            titulo="Nenhuma categoria encontrada"
            descricao={
              filtros.q ? "Ajuste a busca ou a situação." : "Cadastre a primeira categoria."
            }
          />
        }
        colunas={[
          {
            chave: "nome",
            titulo: "Categoria",
            principal: true,
            render: (c) =>
              podeEditar ? (
                <Link
                  href={`/cadastros/categorias/${c.id}`}
                  className="font-medium text-primaria hover:underline"
                >
                  {c.nome}
                </Link>
              ) : (
                <span className="font-medium">{c.nome}</span>
              ),
          },
          {
            chave: "modo",
            titulo: "Controle",
            render: (c) => (
              <Badge tom={c.modoControle === "INDIVIDUAL" ? "info" : "neutro"}>
                {c.modoControle === "INDIVIDUAL" ? "Individual" : "Lote"}
              </Badge>
            ),
          },
          { chave: "unidade", titulo: "Unidade", render: (c) => c.unidadePadrao },
          { chave: "exigencias", titulo: "Exigências", render: exigencias },
          {
            chave: "situacao",
            titulo: "Situação",
            render: (c) => <SituacaoBadge ativo={c.ativo} />,
          },
        ]}
      />
      <Pagination
        caminho="/cadastros/categorias"
        parametros={parametros}
        paginacao={filtros.paginacao}
        total={total}
      />
    </>
  );
}
