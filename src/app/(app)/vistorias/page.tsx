import { ClipboardCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

import { DataTable } from "@/components/tables/data-table";
import { Pagination } from "@/components/tables/pagination";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ROTULO_TIPO_VISTORIA } from "@/features/vistorias/rotulos";
import { exigirContexto } from "@/lib/auth/contexto";
import { formatarDataHora } from "@/lib/format/datas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { intervaloPaginacao, paginacaoSchema } from "@/lib/validation/comum";

export const metadata: Metadata = { title: "Vistorias" };

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function VistoriasPage({ searchParams }: PageProps<"/vistorias">) {
  const contexto = await exigirContexto();
  const p = await searchParams;
  const paginacao = paginacaoSchema.parse({ pagina: um(p.pagina), tamanho: um(p.tamanho) });
  const status = z
    .enum(["RASCUNHO", "CONCLUIDA"])
    .nullable()
    .catch(null)
    .parse(um(p.status) ?? null);
  const { de, ate } = intervaloPaginacao(paginacao);
  const supabase = await createSupabaseServerClient();
  let consulta = supabase
    .from("vistorias")
    .select(
      "id, tipo, status, data_evento, bens(codigo), lotes(codigo), modelos_checklist(nome, versao)",
      { count: "exact" },
    )
    .eq("empresa_id", contexto.empresa.id)
    .neq("status", "CANCELADA")
    .order("data_evento", { ascending: false })
    .range(de, ate);
  if (status) consulta = consulta.eq("status", status);
  const { data, count, error } = await consulta;
  if (error) throw new Error("Falha ao listar vistorias");
  const linhas = (data ?? []).map((v) => ({
    id: v.id,
    tipo: v.tipo,
    status: v.status,
    dataEvento: v.data_evento,
    alvo: v.bens?.codigo ?? v.lotes?.codigo ?? "Item em recebimento",
    checklist: v.modelos_checklist
      ? `${v.modelos_checklist.nome} v${v.modelos_checklist.versao}`
      : "—",
  }));
  const fuso = contexto.empresa.timezone;
  return (
    <>
      <PageHeader
        titulo="Vistorias"
        descricao="Checklists respondidos, com a versão do modelo usada em cada vistoria."
      />
      <nav aria-label="Filtrar por situação" className="mb-4 flex flex-wrap gap-2">
        {[
          ["", "Todas"],
          ["RASCUNHO", "Em andamento"],
          ["CONCLUIDA", "Concluídas"],
        ].map(([valor, rotulo]) => (
          <Link
            key={valor}
            href={valor ? `/vistorias?status=${valor}` : "/vistorias"}
            aria-current={(status ?? "") === valor ? "page" : undefined}
            className="flex min-h-11 items-center rounded-md border border-borda px-3 aria-[current=page]:border-primaria aria-[current=page]:text-primaria"
          >
            {rotulo}
          </Link>
        ))}
      </nav>
      <DataTable
        legenda="Vistorias"
        linhas={linhas}
        chaveLinha={(v) => v.id}
        vazio={
          <EmptyState
            icone={ClipboardCheck}
            titulo="Nenhuma vistoria"
            descricao="Vistorias de entrada são feitas no recebimento."
          />
        }
        colunas={[
          {
            chave: "alvo",
            titulo: "Bem/lote",
            principal: true,
            render: (v) => (
              <Link
                href={`/vistorias/${v.id}`}
                className="font-mono font-medium text-primaria hover:underline"
              >
                {v.alvo}
              </Link>
            ),
          },
          { chave: "tipo", titulo: "Tipo", render: (v) => ROTULO_TIPO_VISTORIA[v.tipo] ?? v.tipo },
          { chave: "data", titulo: "Data", render: (v) => formatarDataHora(v.dataEvento, fuso) },
          { chave: "checklist", titulo: "Checklist", render: (v) => v.checklist },
          {
            chave: "status",
            titulo: "Situação",
            render: (v) => (
              <Badge tom={v.status === "CONCLUIDA" ? "sucesso" : "alerta"}>
                {v.status === "CONCLUIDA" ? "Concluída" : "Em andamento"}
              </Badge>
            ),
          },
        ]}
      />
      <Pagination caminho="/vistorias" parametros={p} paginacao={paginacao} total={count ?? 0} />
    </>
  );
}
