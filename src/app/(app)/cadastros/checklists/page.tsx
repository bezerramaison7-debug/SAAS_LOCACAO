import { ClipboardList, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DataTable } from "@/components/tables/data-table";
import { Pagination } from "@/components/tables/pagination";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChecklistBadge } from "@/features/cadastros/checklists/components/status-badge";
import { listarModelos, type ModeloChecklist } from "@/features/cadastros/checklists/queries";
import { lerFiltrosCadastro } from "@/features/cadastros/comum";
import { BarraFiltros } from "@/features/cadastros/components/barra-filtros";
import { exigirPermissaoPagina, pode } from "@/lib/auth/autorizacao";
import { exigirContexto } from "@/lib/auth/contexto";
import { formatarData } from "@/lib/format/datas";

export const metadata: Metadata = { title: "Checklists" };

export default async function ChecklistsPage({ searchParams }: PageProps<"/cadastros/checklists">) {
  const contexto = await exigirContexto();
  exigirPermissaoPagina(contexto, "dados.ler_geral");
  const parametros = await searchParams;
  const filtros = lerFiltrosCadastro(parametros);
  const { linhas, total } = await listarModelos(contexto, filtros);
  const podeEditar = pode(contexto, "checklist.gerenciar");

  return (
    <>
      <PageHeader
        titulo="Checklists"
        descricao="Modelos de vistoria. Versão publicada é imutável; alterações geram nova versão."
        acaoPrimaria={
          podeEditar ? (
            <Button asChild variante="primaria">
              <Link href="/cadastros/checklists/novo">
                <Plus aria-hidden /> Novo checklist
              </Link>
            </Button>
          ) : undefined
        }
      />
      <BarraFiltros filtros={filtros} rotuloBusca="Buscar por nome ou descrição" />
      <p className="mb-3 text-sm text-texto-suave">
        “Ativos” mostra rascunhos e versões vigentes; “Inativos”, versões arquivadas.
      </p>
      <DataTable<ModeloChecklist>
        legenda="Modelos de checklist"
        linhas={linhas}
        chaveLinha={(m) => m.id}
        vazio={
          <EmptyState
            icone={ClipboardList}
            titulo="Nenhum checklist encontrado"
            descricao={
              filtros.q ? "Ajuste a busca ou a situação." : "Crie o primeiro modelo de checklist."
            }
          />
        }
        colunas={[
          {
            chave: "nome",
            titulo: "Checklist",
            principal: true,
            render: (m) => (
              <Link
                href={`/cadastros/checklists/${m.id}`}
                className="font-medium text-primaria hover:underline"
              >
                {m.nome}
              </Link>
            ),
          },
          { chave: "versao", titulo: "Versão", render: (m) => `v${m.versao}` },
          {
            chave: "status",
            titulo: "Situação",
            render: (m) => <StatusChecklistBadge status={m.status} />,
          },
          { chave: "perguntas", titulo: "Perguntas", render: (m) => m.perguntas },
          {
            chave: "publicado",
            titulo: "Publicado em",
            render: (m) =>
              m.publicadoEm ? formatarData(m.publicadoEm, contexto.empresa.timezone) : "—",
          },
        ]}
      />
      <Pagination
        caminho="/cadastros/checklists"
        parametros={parametros}
        paginacao={filtros.paginacao}
        total={total}
      />
    </>
  );
}
