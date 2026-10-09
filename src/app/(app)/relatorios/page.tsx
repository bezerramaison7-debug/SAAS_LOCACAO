import { FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DataTable } from "@/components/tables/data-table";
import { Pagination } from "@/components/tables/pagination";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { opcoesLocais } from "@/features/cadastros/locais/queries";
import { FormRelatorio } from "@/features/relatorios/components/form-relatorio";
import { listarRelatorios } from "@/features/relatorios/queries";
import {
  ROTULO_STATUS_RELATORIO,
  ROTULO_TIPO_RELATORIO,
  TOM_STATUS_RELATORIO,
  type TipoRelatorio,
} from "@/features/relatorios/rotulos";
import { exigirPermissaoPagina } from "@/lib/auth/autorizacao";
import { exigirContexto } from "@/lib/auth/contexto";
import { formatarDataHora, hojeNoFuso } from "@/lib/format/datas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { paginacaoSchema } from "@/lib/validation/comum";

export const metadata: Metadata = { title: "Relatórios" };

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function RelatoriosPage({ searchParams }: PageProps<"/relatorios">) {
  const contexto = await exigirContexto();
  exigirPermissaoPagina(contexto, "relatorio.gerar");
  const p = await searchParams;
  const paginacao = paginacaoSchema.parse({ pagina: um(p.pagina), tamanho: um(p.tamanho) });
  const supabase = await createSupabaseServerClient();
  const [{ linhas, total }, locais, { data: locacoes }] = await Promise.all([
    listarRelatorios(contexto, paginacao),
    opcoesLocais(contexto),
    supabase
      .from("locacoes")
      .select("id, codigo")
      .eq("empresa_id", contexto.empresa.id)
      .neq("status", "RASCUNHO")
      .order("codigo", { ascending: false })
      .limit(500),
  ]);
  const fuso = contexto.empresa.timezone;
  const hoje = hojeNoFuso(fuso);

  return (
    <>
      <PageHeader
        titulo="Relatórios"
        descricao="PDFs gerados no servidor, com fotos, legendas e hash de integridade."
      />
      <section aria-labelledby="novo" className="mb-8 space-y-3">
        <h2 id="novo" className="text-xl font-semibold">
          Novo relatório
        </h2>
        <FormRelatorio
          locacoes={(locacoes ?? []).map((l) => ({ id: l.id, rotulo: l.codigo }))}
          locais={locais.map((l) => ({ id: l.id, rotulo: l.rotulo }))}
          hoje={hoje}
          inicioMes={`${hoje.slice(0, 8)}01`}
        />
      </section>
      <section aria-labelledby="gerados" className="space-y-3">
        <h2 id="gerados" className="text-xl font-semibold">
          Relatórios gerados
        </h2>
        <DataTable
          legenda="Relatórios gerados"
          linhas={linhas}
          chaveLinha={(r) => r.id}
          vazio={
            <EmptyState
              icone={FileText}
              titulo="Nenhum relatório ainda"
              descricao="Gere o primeiro pelo formulário acima ou pela página da locação ou do bem."
            />
          }
          colunas={[
            {
              chave: "codigo",
              titulo: "Relatório",
              principal: true,
              render: (r) => (
                <Link
                  href={`/relatorios/${r.id}`}
                  className="font-mono font-medium text-primaria hover:underline"
                >
                  {r.codigo}
                </Link>
              ),
            },
            {
              chave: "tipo",
              titulo: "Tipo",
              render: (r) =>
                `${ROTULO_TIPO_RELATORIO[r.tipo as TipoRelatorio] ?? r.tipo} · ${r.alvoDescricao}`,
            },
            {
              chave: "status",
              titulo: "Situação",
              render: (r) => (
                <Badge tom={TOM_STATUS_RELATORIO[r.status]}>
                  {ROTULO_STATUS_RELATORIO[r.status]}
                </Badge>
              ),
            },
            {
              chave: "pedido",
              titulo: "Pedido em",
              render: (r) => formatarDataHora(r.created_at, fuso),
            },
          ]}
        />
        <Pagination caminho="/relatorios" parametros={p} paginacao={paginacao} total={total} />
      </section>
    </>
  );
}
