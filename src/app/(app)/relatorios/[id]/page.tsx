import { Download } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { AcompanharRelatorio } from "@/features/relatorios/components/acompanhar";
import { BotaoRelatorio } from "@/features/relatorios/components/botao-relatorio";
import { obterRelatorio } from "@/features/relatorios/queries";
import {
  ROTULO_STATUS_RELATORIO,
  ROTULO_TIPO_RELATORIO,
  TOM_STATUS_RELATORIO,
  type TipoRelatorio,
} from "@/features/relatorios/rotulos";
import { exigirPermissaoPagina } from "@/lib/auth/autorizacao";
import { exigirContexto } from "@/lib/auth/contexto";
import { formatarDataHora } from "@/lib/format/datas";
import { uuidSchema } from "@/lib/validation/comum";

export const metadata: Metadata = { title: "Relatório" };

export default async function RelatorioPage({ params }: PageProps<"/relatorios/[id]">) {
  const contexto = await exigirContexto();
  exigirPermissaoPagina(contexto, "relatorio.gerar");
  const id = uuidSchema.safeParse((await params).id);
  const r = id.success ? await obterRelatorio(contexto, id.data) : null;
  if (!r) notFound();
  const fuso = contexto.empresa.timezone;
  const tipo = r.tipo as TipoRelatorio;
  const data = (v: string | null) => (v ? formatarDataHora(v, fuso) : "—");

  return (
    <>
      <PageHeader
        titulo={`Relatório ${r.codigo}`}
        descricao={`${ROTULO_TIPO_RELATORIO[tipo] ?? r.tipo} · ${r.alvoDescricao}`}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Badge tom={TOM_STATUS_RELATORIO[r.status]}>{ROTULO_STATUS_RELATORIO[r.status]}</Badge>
        <AcompanharRelatorio id={r.id} status={r.status} />
      </div>
      {r.status === "CONCLUIDO" ? (
        <a
          href={`/api/reports/${r.id}/download`}
          className={buttonVariants({ variante: "primaria", className: "mb-6" })}
        >
          <Download aria-hidden /> Baixar PDF
        </a>
      ) : null}
      {r.status === "ERRO" ? (
        <Alert
          tom="perigo"
          className="mb-6"
          titulo={
            r.tentativas >= 3
              ? "Não foi possível gerar o relatório após 3 tentativas."
              : "A geração falhou; uma nova tentativa será feita automaticamente."
          }
        >
          {r.erro}
        </Alert>
      ) : null}
      {r.status === "ERRO" && r.tentativas >= 3 && r.alvoId && tipo !== "PERIODO" ? (
        <div className="mb-6">
          <BotaoRelatorio tipo={tipo} alvo={r.alvoId} />
        </div>
      ) : null}
      <dl className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["Pedido em", data(r.created_at)],
            ["Gerado em", data(r.concluido_em)],
            ["Versão do template", r.versao_template],
            ["Tentativas", String(r.tentativas)],
            ["Hash SHA-256 dos dados (impresso no PDF)", r.hash_dados ?? "—"],
            ["Hash SHA-256 do arquivo", r.hash_arquivo ?? "—"],
            ["Assinatura HMAC", r.assinatura_hmac ?? "—"],
          ] as [string, string][]
        ).map(([t, v]) => (
          <div key={t} className="rounded-md border border-borda bg-superficie p-3">
            <dt className="text-sm text-texto-suave">{t}</dt>
            <dd className="font-mono text-sm break-all">{v}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
