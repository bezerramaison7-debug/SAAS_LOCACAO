import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AcaoConfirmada } from "@/components/forms/acao-confirmada";
import { AcaoSimples } from "@/components/forms/acao-simples";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { conferirCobranca, marcarDivergente, resolverCobranca } from "@/features/cobrancas/actions";
import { obterCobranca } from "@/features/cobrancas/queries";
import { EnviarArquivo } from "@/features/evidencias/components/enviar-arquivo";
import { GaleriaEvidencias } from "@/features/evidencias/components/galeria";
import { evidenciasDe } from "@/features/evidencias/queries";
import { ROTULO_STATUS_COBRANCA, rotulo } from "@/features/locacoes/rotulos-eventos";
import { exigirPermissaoPagina, pode } from "@/lib/auth/autorizacao";
import { exigirContexto } from "@/lib/auth/contexto";
import { formatarDataCivil, formatarDataHora } from "@/lib/format/datas";
import { formatarMoeda } from "@/lib/format/moeda";
import { uuidSchema } from "@/lib/validation/comum";

export const metadata: Metadata = { title: "Cobrança" };

const AVISOS = {
  registrada: "Cobrança registrada. Anexe o documento e confira quando possível.",
  conferida: "Cobrança conferida.",
  divergente: "Divergência registrada.",
  resolvida: "Divergência resolvida.",
} as const;

export default async function CobrancaPage({ params, searchParams }: PageProps<"/cobrancas/[id]">) {
  const contexto = await exigirContexto();
  exigirPermissaoPagina(contexto, "valores.ver");
  const id = uuidSchema.safeParse((await params).id);
  const c = id.success ? await obterCobranca(contexto, id.data) : null;
  if (!c) notFound();
  const p = await searchParams;
  const aviso = (Object.keys(AVISOS) as (keyof typeof AVISOS)[]).find((k) => p[k]);
  const fuso = contexto.empresa.timezone;
  const documentos = await evidenciasDe(contexto, "COBRANCA", [c.id]);
  const gerencia = pode(contexto, "cobranca.gerenciar") && !c.financeiroEncerrado;

  return (
    <>
      <PageHeader
        titulo={`Cobrança ${c.codigo}`}
        descricao={`Competência ${formatarDataCivil(c.competenciaInicio)} a ${formatarDataCivil(c.competenciaFim)}`}
      />
      {aviso ? <Alert tom="sucesso" titulo={AVISOS[aviso]} className="mb-4" /> : null}
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge
          tom={
            c.status === "DIVERGENTE" ? "perigo" : c.status === "PENDENTE" ? "alerta" : "sucesso"
          }
        >
          {rotulo(ROTULO_STATUS_COBRANCA, c.status)}
        </Badge>
        {c.financeiroEncerrado ? <Badge>Locação com encerramento financeiro</Badge> : null}
      </div>
      <dl className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(
          [
            [
              "Locação",
              <Link
                key="l"
                href={`/locacoes/${c.locacaoId}?aba=cobrancas`}
                className="text-primaria hover:underline"
              >
                {c.locacao}
              </Link>,
            ],
            ["Valor cobrado", formatarMoeda(c.valor)],
            ["Número do documento", c.documento ?? "—"],
            ["Registrada em", formatarDataHora(c.criadaEm, fuso)],
            ["Conferida em", c.conferidaEm ? formatarDataHora(c.conferidaEm, fuso) : "—"],
            ...(c.motivoDivergencia
              ? [["Divergência", c.motivoDivergencia] as [string, string]]
              : []),
            ...(c.resolucao ? [["Resolução", c.resolucao] as [string, string]] : []),
            ...(c.observacoes ? [["Observações", c.observacoes] as [string, string]] : []),
          ] as [string, React.ReactNode][]
        ).map(([t, v]) => (
          <div key={t} className="rounded-md border border-borda bg-superficie p-3">
            <dt className="text-sm text-texto-suave">{t}</dt>
            <dd className="font-medium break-words">{v}</dd>
          </div>
        ))}
      </dl>
      {gerencia ? (
        <div className="mb-6 flex flex-col gap-2 sm:flex-row">
          {c.status === "PENDENTE" ? (
            <AcaoSimples
              acao={conferirCobranca}
              campos={{ id: c.id }}
              rotulo="Conferir cobrança"
              pendente="Conferindo…"
            />
          ) : null}
          {c.status === "PENDENTE" || c.status === "CONFERIDA" ? (
            <AcaoConfirmada
              acao={marcarDivergente}
              campos={{ id: c.id }}
              rotulo="Marcar divergência"
              variante="secundaria"
              titulo={`Registrar divergência na cobrança ${c.codigo}?`}
              descricao="A cobrança fica divergente até ser resolvida; o encerramento financeiro fica bloqueado."
              rotuloConfirmar="Registrar divergência"
              motivo={{ rotulo: "Descreva a divergência" }}
            />
          ) : null}
          {c.status === "DIVERGENTE" ? (
            <AcaoConfirmada
              acao={resolverCobranca}
              campos={{ id: c.id }}
              rotulo="Resolver divergência"
              titulo={`Resolver a divergência da cobrança ${c.codigo}?`}
              descricao="Registre como foi resolvida (ex.: nota de crédito, novo documento)."
              rotuloConfirmar="Resolver"
              motivo={{ rotulo: "Como foi resolvida" }}
            />
          ) : null}
        </div>
      ) : null}
      <section aria-labelledby="documentos" className="space-y-3">
        <h2 id="documentos" className="text-xl font-semibold">
          Documento da cobrança
        </h2>
        <GaleriaEvidencias
          evidencias={documentos}
          fuso={fuso}
          podeGerenciar={pode(contexto, "evidencia.substituir_remover")}
          caminho={`/cobrancas/${c.id}`}
          entidadeTipo="COBRANCA"
        />
        {pode(contexto, "evidencia.enviar") ? (
          <EnviarArquivo
            entidadeTipo="COBRANCA"
            entidadeId={c.id}
            tipo="DOCUMENTO"
            rotulo="Anexar documento"
          />
        ) : null}
      </section>
    </>
  );
}
