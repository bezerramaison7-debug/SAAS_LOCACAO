import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { DetalheAtivo } from "@/features/bens/components-detalhe";
import { obterBem, vistoriasDe } from "@/features/bens/queries";
import { evidenciasDe } from "@/features/evidencias/queries";
import { ROTULO_STATUS_BEM, rotulo } from "@/features/locacoes/rotulos-eventos";
import { exigirContexto } from "@/lib/auth/contexto";
import { formatarDataHora } from "@/lib/format/datas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/comum";

export const metadata: Metadata = { title: "Bem" };

export default async function BemPage({ params }: PageProps<"/bens/[id]">) {
  const contexto = await exigirContexto();
  const id = uuidSchema.safeParse((await params).id);
  // RLS: RESPONSAVEL_LOCAL só enxerga os bens sob sua responsabilidade.
  const bem = id.success ? await obterBem(contexto, id.data) : null;
  if (!bem) notFound();
  const supabase = await createSupabaseServerClient();
  const { data: linha } = await supabase
    .from("itens_recebimento")
    .select("id")
    .eq("bem_id", bem.id)
    .maybeSingle();
  const [vistorias, fotos, fotosRecebimento] = await Promise.all([
    vistoriasDe(contexto, { bem: bem.id }),
    evidenciasDe(contexto, "BEM", [bem.id]),
    linha ? evidenciasDe(contexto, "ITEM_RECEBIMENTO", [linha.id]) : Promise.resolve([]),
  ]);
  const fuso = contexto.empresa.timezone;
  return (
    <>
      <PageHeader
        titulo={`Bem ${bem.codigo}`}
        descricao={bem.numeroSerie ? `Série ${bem.numeroSerie}` : undefined}
      />
      <div className="mb-4">
        <Badge>{rotulo(ROTULO_STATUS_BEM, bem.status)}</Badge>
      </div>
      <DetalheAtivo
        contexto={contexto}
        entidade="BEM"
        entidadeId={bem.id}
        caminho={`/bens/${bem.id}`}
        vistorias={vistorias}
        fotos={fotos}
        fotosRecebimento={fotosRecebimento}
        dados={[
          ["Local atual", bem.local ?? "—"],
          ["Responsável atual", bem.responsavel ?? "—"],
          ["Número de série", bem.numeroSerie ?? "—"],
          ["Placa", bem.placa ?? "—"],
          ["Patrimônio do fornecedor", bem.identificacaoFornecedor ?? "—"],
          [
            "Recebimento",
            bem.recebimento ? (
              <Link
                href={`/recebimentos/${bem.recebimento.id}`}
                className="text-primaria hover:underline"
              >
                {bem.recebimento.codigo}
                {bem.recebimento.dataEvento
                  ? ` em ${formatarDataHora(bem.recebimento.dataEvento, fuso)}`
                  : ""}
              </Link>
            ) : (
              "—"
            ),
          ],
          [
            "Locação",
            bem.locacao ? (
              <Link href={`/locacoes/${bem.locacao.id}`} className="text-primaria hover:underline">
                {bem.locacao.codigo}
              </Link>
            ) : (
              "—"
            ),
          ],
        ]}
      />
    </>
  );
}
