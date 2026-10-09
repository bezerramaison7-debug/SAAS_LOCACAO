import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { DetalheAtivo } from "@/features/bens/components-detalhe";
import { CabecalhoFicha } from "@/features/bens/ficha";
import { LinhaDoTempo } from "@/features/bens/linha-do-tempo";
import { obterLote, vistoriasDe } from "@/features/bens/queries";
import { evidenciasDe } from "@/features/evidencias/queries";
import { ROTULO_STATUS_LOTE, rotulo } from "@/features/locacoes/rotulos-eventos";
import { exigirContexto } from "@/lib/auth/contexto";
import { formatarDataHora } from "@/lib/format/datas";
import { formatarQuantidade } from "@/lib/format/moeda";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/comum";

export const metadata: Metadata = { title: "Lote" };

export default async function LotePage({ params }: PageProps<"/bens/lotes/[id]">) {
  const contexto = await exigirContexto();
  const id = uuidSchema.safeParse((await params).id);
  const lote = id.success ? await obterLote(contexto, id.data) : null;
  if (!lote) notFound();
  const supabase = await createSupabaseServerClient();
  const { data: linha } = await supabase
    .from("itens_recebimento")
    .select("id")
    .eq("lote_id", lote.id)
    .maybeSingle();
  const [vistorias, fotos, fotosRecebimento] = await Promise.all([
    vistoriasDe(contexto, { lote: lote.id }),
    evidenciasDe(contexto, "LOTE", [lote.id]),
    linha ? evidenciasDe(contexto, "ITEM_RECEBIMENTO", [linha.id]) : Promise.resolve([]),
  ]);
  const fuso = contexto.empresa.timezone;
  return (
    <>
      <PageHeader
        titulo={`Lote ${lote.codigo}`}
        descricao={`Saldo ${formatarQuantidade(lote.saldo)}`}
      />
      <div className="mb-4">
        <Badge>{rotulo(ROTULO_STATUS_LOTE, lote.status)}</Badge>
      </div>
      <DetalheAtivo
        contexto={contexto}
        entidade="LOTE"
        entidadeId={lote.id}
        cabecalho={
          <CabecalhoFicha
            contexto={contexto}
            alvo={{
              tipo: "lote",
              id: lote.id,
              status: lote.status,
              temChecklist: lote.temChecklist,
            }}
          />
        }
        linhaDoTempo={<LinhaDoTempo contexto={contexto} alvo={{ lote: lote.id }} />}
        caminho={`/bens/lotes/${lote.id}`}
        vistorias={vistorias}
        fotos={fotos}
        fotosRecebimento={fotosRecebimento}
        dados={[
          ["Item contratado", lote.item || "—"],
          ["Local atual", lote.local ?? "—"],
          ["Responsável atual", lote.responsavel],
          ["Recebido", formatarQuantidade(lote.recebida)],
          ["Devolvido", formatarQuantidade(lote.devolvida)],
          ["Baixado (indenizado)", formatarQuantidade(lote.baixada)],
          [
            "Recebimento",
            lote.recebimento ? (
              <Link
                href={`/recebimentos/${lote.recebimento.id}`}
                className="text-primaria hover:underline"
              >
                {lote.recebimento.codigo}
                {lote.recebimento.dataEvento
                  ? ` em ${formatarDataHora(lote.recebimento.dataEvento, fuso)}`
                  : ""}
              </Link>
            ) : lote.loteOrigemId ? (
              <Link
                href={`/bens/lotes/${lote.loteOrigemId}`}
                className="text-primaria hover:underline"
              >
                Divisão de outro lote
              </Link>
            ) : (
              "—"
            ),
          ],
          [
            "Locação",
            lote.locacao ? (
              <Link href={`/locacoes/${lote.locacao.id}`} className="text-primaria hover:underline">
                {lote.locacao.codigo}
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
