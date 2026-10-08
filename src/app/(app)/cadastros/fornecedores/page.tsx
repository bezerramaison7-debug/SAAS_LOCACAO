import { Building, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DataTable } from "@/components/tables/data-table";
import { Pagination } from "@/components/tables/pagination";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { lerFiltrosCadastro } from "@/features/cadastros/comum";
import { BarraFiltros } from "@/features/cadastros/components/barra-filtros";
import { SituacaoBadge } from "@/features/cadastros/components/situacao-badge";
import { listarFornecedores, type Fornecedor } from "@/features/cadastros/fornecedores/queries";
import { exigirPermissaoPagina, pode } from "@/lib/auth/autorizacao";
import { exigirContexto } from "@/lib/auth/contexto";

export const metadata: Metadata = { title: "Fornecedores" };

export default async function FornecedoresPage({
  searchParams,
}: PageProps<"/cadastros/fornecedores">) {
  const contexto = await exigirContexto();
  exigirPermissaoPagina(contexto, "dados.ler_geral");
  const parametros = await searchParams;
  const filtros = lerFiltrosCadastro(parametros);
  const { linhas, total } = await listarFornecedores(contexto, filtros);
  const podeEditar = pode(contexto, "fornecedor.gerenciar");

  return (
    <>
      <PageHeader
        titulo="Fornecedores"
        descricao="Locadoras vinculadas às locações."
        acaoPrimaria={
          podeEditar ? (
            <Button asChild variante="primaria">
              <Link href="/cadastros/fornecedores/novo">
                <Plus aria-hidden /> Novo fornecedor
              </Link>
            </Button>
          ) : undefined
        }
      />
      {parametros.salvo ? (
        <Alert tom="sucesso" titulo="Fornecedor salvo." className="mb-4" />
      ) : null}
      <BarraFiltros
        filtros={filtros}
        rotuloBusca="Buscar por razão social, nome fantasia ou documento"
      />
      <DataTable<Fornecedor>
        legenda="Fornecedores"
        linhas={linhas}
        chaveLinha={(f) => f.id}
        vazio={
          <EmptyState
            icone={Building}
            titulo="Nenhum fornecedor encontrado"
            descricao={
              filtros.q ? "Ajuste a busca ou a situação." : "Cadastre o primeiro fornecedor."
            }
          />
        }
        colunas={[
          {
            chave: "nome",
            titulo: "Fornecedor",
            principal: true,
            render: (f) =>
              podeEditar ? (
                <Link
                  href={`/cadastros/fornecedores/${f.id}`}
                  className="font-medium text-primaria hover:underline"
                >
                  {f.nomeFantasia ?? f.razaoSocial}
                </Link>
              ) : (
                <span className="font-medium">{f.nomeFantasia ?? f.razaoSocial}</span>
              ),
          },
          { chave: "razao", titulo: "Razão social", render: (f) => f.razaoSocial },
          { chave: "documento", titulo: "Documento", render: (f) => f.documento ?? "—" },
          {
            chave: "contato",
            titulo: "Contato",
            render: (f) => f.contatoNome ?? f.contatoEmail ?? "—",
          },
          {
            chave: "situacao",
            titulo: "Situação",
            render: (f) => <SituacaoBadge ativo={f.ativo} />,
          },
        ]}
      />
      <Pagination
        caminho="/cadastros/fornecedores"
        parametros={parametros}
        paginacao={filtros.paginacao}
        total={total}
      />
    </>
  );
}
