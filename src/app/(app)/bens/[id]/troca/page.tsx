import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { FormTroca } from "@/features/bens/form-troca";
import { obterBem } from "@/features/bens/queries";
import { exigirPermissaoPagina } from "@/lib/auth/autorizacao";
import { exigirContexto } from "@/lib/auth/contexto";
import { utcParaHorarioLocal } from "@/lib/format/datas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/comum";

export const metadata: Metadata = { title: "Troca de equipamento" };

export default async function TrocaPage({ params }: PageProps<"/bens/[id]/troca">) {
  const contexto = await exigirContexto();
  exigirPermissaoPagina(contexto, "troca.registrar");
  const id = uuidSchema.safeParse((await params).id);
  const bem = id.success ? await obterBem(contexto, id.data) : null;
  if (!bem) notFound();
  const supabase = await createSupabaseServerClient();
  const { data: cat } = await supabase
    .from("bens")
    .select(
      "itens_locacao(categorias_bem(exige_numero_serie, exige_placa, exige_ident_fornecedor))",
    )
    .eq("id", bem.id)
    .maybeSingle();
  const c = cat?.itens_locacao?.categorias_bem;
  return (
    <>
      <PageHeader
        titulo={`Troca de ${bem.codigo}`}
        descricao="O bem atual é encerrado como substituído e um novo bem entra no mesmo item, no mesmo local e com o mesmo responsável."
      />
      <FormTroca
        bemId={bem.id}
        agoraLocal={utcParaHorarioLocal(new Date(), contexto.empresa.timezone)}
        exige={{
          numeroSerie: c?.exige_numero_serie ?? false,
          placa: c?.exige_placa ?? false,
          identificacaoFornecedor: c?.exige_ident_fornecedor ?? false,
        }}
        atual={{ numeroSerie: bem.numeroSerie, placa: bem.placa }}
      />
    </>
  );
}
