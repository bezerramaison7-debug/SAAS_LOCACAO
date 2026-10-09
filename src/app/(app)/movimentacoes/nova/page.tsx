import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { opcoesLocais } from "@/features/cadastros/locais/queries";
import { FormMovimentacao } from "@/features/movimentacoes/components/form-movimentacao";
import { obterAlvo } from "@/features/movimentacoes/queries";
import { opcoesResponsaveis } from "@/features/recebimentos/queries";
import { exigirPermissaoPagina } from "@/lib/auth/autorizacao";
import { exigirContexto } from "@/lib/auth/contexto";
import { utcParaHorarioLocal } from "@/lib/format/datas";
import { formatarQuantidade } from "@/lib/format/moeda";
import { uuidSchema } from "@/lib/validation/comum";

export const metadata: Metadata = { title: "Nova movimentação" };

export default async function NovaMovimentacaoPage({
  searchParams,
}: PageProps<"/movimentacoes/nova">) {
  const contexto = await exigirContexto();
  exigirPermissaoPagina(contexto, "movimentacao.registrar");
  const p = await searchParams;
  const bem = uuidSchema.safeParse(p.bem);
  const lote = uuidSchema.safeParse(p.lote);
  const alvo = await obterAlvo(contexto, {
    ...(bem.success ? { bem: bem.data } : {}),
    ...(lote.success ? { lote: lote.data } : {}),
  });
  if (!alvo) notFound();
  const [locais, responsaveis] = await Promise.all([
    opcoesLocais(contexto),
    opcoesResponsaveis(contexto),
  ]);
  return (
    <>
      <PageHeader
        titulo={`Movimentar ${alvo.codigo}`}
        descricao={`${alvo.descricao} · hoje em ${alvo.local ?? "—"}`}
      />
      <FormMovimentacao
        alvo={alvo}
        locais={locais}
        responsaveis={responsaveis}
        agoraLocal={utcParaHorarioLocal(new Date(), contexto.empresa.timezone)}
        saldoTexto={alvo.saldo ? `${formatarQuantidade(alvo.saldo)} ${alvo.unidade ?? ""}` : null}
      />
    </>
  );
}
