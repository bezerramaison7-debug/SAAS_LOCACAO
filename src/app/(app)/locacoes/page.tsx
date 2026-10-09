import { FileText, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DataTable } from "@/components/tables/data-table";
import { Pagination } from "@/components/tables/pagination";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { opcoesCentrosCusto } from "@/features/cadastros/centros-custo/queries";
import { opcoesFornecedores } from "@/features/cadastros/fornecedores/queries";
import { opcoesLocais } from "@/features/cadastros/locais/queries";
import { FiltrosLocacoes } from "@/features/locacoes/components/filtros-locacoes";
import { StatusLocacaoBadge } from "@/features/locacoes/components/status-badge";
import { lerFiltrosLocacao, temFiltroAtivo } from "@/features/locacoes/filtros";
import { buscarLocacoes, type LinhaLocacao } from "@/features/locacoes/queries";
import { pode } from "@/lib/auth/autorizacao";
import { exigirContexto } from "@/lib/auth/contexto";
import { formatarDataCivil } from "@/lib/format/datas";

export const metadata: Metadata = { title: "Locações" };

function vigencia(l: LinhaLocacao): string {
  if (!l.inicioPrevisto && !l.terminoPrevisto) return "—";
  const de = l.inicioPrevisto ? formatarDataCivil(l.inicioPrevisto) : "?";
  const ate = l.terminoPrevisto ? formatarDataCivil(l.terminoPrevisto) : "?";
  return `${de} a ${ate}`;
}

export default async function LocacoesPage({ searchParams }: PageProps<"/locacoes">) {
  const contexto = await exigirContexto();
  const parametros = await searchParams;
  const filtros = lerFiltrosLocacao(parametros);
  const [{ linhas, total }, fornecedores, centros, locais] = await Promise.all([
    buscarLocacoes(contexto, filtros),
    opcoesFornecedores(contexto),
    opcoesCentrosCusto(contexto),
    opcoesLocais(contexto),
  ]);
  const podeCriar = pode(contexto, "locacao.criar");

  return (
    <>
      <PageHeader
        titulo="Locações"
        descricao="Contratos de locação vinculados manualmente aos pedidos do Sectra."
        acaoPrimaria={
          podeCriar ? (
            <Button asChild variante="primaria">
              <Link href="/locacoes/nova">
                <Plus aria-hidden /> Nova locação
              </Link>
            </Button>
          ) : undefined
        }
      />
      <FiltrosLocacoes
        filtros={filtros}
        fornecedores={fornecedores}
        centros={centros}
        locais={locais}
      />
      <p className="mb-2 text-sm text-texto-suave" aria-live="polite">
        {total === 1 ? "1 locação encontrada" : `${total} locações encontradas`}
      </p>
      <DataTable<LinhaLocacao>
        legenda="Locações"
        linhas={linhas}
        chaveLinha={(l) => l.id}
        vazio={
          <EmptyState
            icone={FileText}
            titulo="Nenhuma locação encontrada"
            descricao={
              temFiltroAtivo(filtros)
                ? "Ajuste ou limpe os filtros."
                : podeCriar
                  ? "Cadastre a primeira locação."
                  : "Ainda não há locações."
            }
          />
        }
        colunas={[
          {
            chave: "codigo",
            titulo: "Locação",
            principal: true,
            render: (l) => (
              <Link
                href={`/locacoes/${l.id}`}
                className="font-mono font-medium text-primaria hover:underline"
              >
                {l.codigo}
              </Link>
            ),
          },
          {
            chave: "status",
            titulo: "Situação",
            render: (l) => <StatusLocacaoBadge status={l.status} />,
          },
          { chave: "fornecedor", titulo: "Fornecedor", render: (l) => l.fornecedor ?? "—" },
          { chave: "pedido", titulo: "Pedido Sectra", render: (l) => l.pedidosSectra ?? "—" },
          { chave: "centro", titulo: "Centro de custo", render: (l) => l.centroCusto ?? "—" },
          { chave: "vigencia", titulo: "Vigência prevista", render: vigencia },
        ]}
      />
      <Pagination
        caminho="/locacoes"
        parametros={parametros}
        paginacao={filtros.paginacao}
        total={total}
      />
    </>
  );
}
