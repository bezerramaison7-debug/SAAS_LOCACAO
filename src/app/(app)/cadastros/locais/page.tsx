import { MapPin, Plus } from "lucide-react";
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
import { listarLocais, type Local } from "@/features/cadastros/locais/queries";
import { ROTULO_TIPO_LOCAL } from "@/features/cadastros/locais/schemas";
import { exigirPermissaoPagina, pode } from "@/lib/auth/autorizacao";
import { exigirContexto } from "@/lib/auth/contexto";

export const metadata: Metadata = { title: "Locais" };

export default async function LocaisPage({ searchParams }: PageProps<"/cadastros/locais">) {
  const contexto = await exigirContexto();
  exigirPermissaoPagina(contexto, "dados.ler_geral");
  const parametros = await searchParams;
  const filtros = lerFiltrosCadastro(parametros);
  const { linhas, total } = await listarLocais(contexto, filtros);
  const podeEditar = pode(contexto, "local.gerenciar");

  return (
    <>
      <PageHeader
        titulo="Locais"
        descricao="Obras, almoxarifados e escritórios onde os bens ficam."
        acaoPrimaria={
          podeEditar ? (
            <Button asChild variante="primaria">
              <Link href="/cadastros/locais/novo">
                <Plus aria-hidden /> Novo local
              </Link>
            </Button>
          ) : undefined
        }
      />
      {parametros.salvo ? <Alert tom="sucesso" titulo="Local salvo." className="mb-4" /> : null}
      <BarraFiltros filtros={filtros} rotuloBusca="Buscar por código, nome ou endereço" />
      <DataTable<Local>
        legenda="Locais"
        linhas={linhas}
        chaveLinha={(l) => l.id}
        vazio={
          <EmptyState
            icone={MapPin}
            titulo="Nenhum local encontrado"
            descricao={filtros.q ? "Ajuste a busca ou a situação." : "Cadastre o primeiro local."}
          />
        }
        colunas={[
          {
            chave: "nome",
            titulo: "Local",
            principal: true,
            render: (l) =>
              podeEditar ? (
                <Link
                  href={`/cadastros/locais/${l.id}`}
                  className="font-medium text-primaria hover:underline"
                >
                  {l.nome}
                </Link>
              ) : (
                <span className="font-medium">{l.nome}</span>
              ),
          },
          {
            chave: "codigo",
            titulo: "Código",
            render: (l) => <span className="font-mono">{l.codigo}</span>,
          },
          { chave: "tipo", titulo: "Tipo", render: (l) => ROTULO_TIPO_LOCAL[l.tipo] },
          { chave: "endereco", titulo: "Endereço", render: (l) => l.endereco ?? "—" },
          {
            chave: "situacao",
            titulo: "Situação",
            render: (l) => <SituacaoBadge ativo={l.ativo} />,
          },
        ]}
      />
      <Pagination
        caminho="/cadastros/locais"
        parametros={parametros}
        paginacao={filtros.paginacao}
        total={total}
      />
    </>
  );
}
