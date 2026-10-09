import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { obterAlvo } from "@/features/movimentacoes/queries";
import { FormOcorrencia } from "@/features/ocorrencias/components/formularios";
import { TIPOS_REGISTRAVEIS } from "@/features/ocorrencias/rotulos";
import { obterLocacao } from "@/features/locacoes/queries";
import { exigirPermissaoPagina } from "@/lib/auth/autorizacao";
import { exigirContexto } from "@/lib/auth/contexto";
import { utcParaHorarioLocal } from "@/lib/format/datas";
import { uuidSchema } from "@/lib/validation/comum";

export const metadata: Metadata = { title: "Nova ocorrência" };

export default async function NovaOcorrenciaPage({ searchParams }: PageProps<"/ocorrencias/nova">) {
  const contexto = await exigirContexto();
  exigirPermissaoPagina(contexto, "ocorrencia.registrar");
  const p = await searchParams;
  const bem = uuidSchema.safeParse(p.bem);
  const lote = uuidSchema.safeParse(p.lote);
  const locacaoId = uuidSchema.safeParse(p.locacao);
  const alvo =
    bem.success || lote.success
      ? await obterAlvo(contexto, {
          ...(bem.success ? { bem: bem.data } : {}),
          ...(lote.success ? { lote: lote.data } : {}),
        })
      : null;
  const locacao = !alvo && locacaoId.success ? await obterLocacao(contexto, locacaoId.data) : null;
  if (!alvo && !locacao) notFound();
  // Nota 4 de permissions.md: Financeiro registra só divergência documental.
  const tipos =
    contexto.papel === "FINANCEIRO" ? (["DIVERGENCIA_DOCUMENTAL"] as const) : TIPOS_REGISTRAVEIS;
  return (
    <>
      <PageHeader
        titulo="Nova ocorrência"
        descricao={alvo ? `${alvo.codigo} · ${alvo.descricao}` : `Locação ${locacao?.codigo ?? ""}`}
      />
      <FormOcorrencia
        alvo={
          alvo
            ? alvo.tipo === "bem"
              ? { bemId: alvo.id }
              : { loteId: alvo.id, unidade: alvo.unidade }
            : { locacaoId: locacao?.id ?? "" }
        }
        agoraLocal={utcParaHorarioLocal(new Date(), contexto.empresa.timezone)}
        tiposPermitidos={tipos}
      />
    </>
  );
}
