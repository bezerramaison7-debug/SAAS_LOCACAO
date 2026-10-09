import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { type ReactNode } from "react";

import { AcaoConfirmada } from "@/components/forms/acao-confirmada";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EnviarArquivo } from "@/features/evidencias/components/enviar-arquivo";
import { GaleriaEvidencias } from "@/features/evidencias/components/galeria";
import { evidenciasDe } from "@/features/evidencias/queries";
import { cancelarOcorrencia, reabrirOcorrencia } from "@/features/ocorrencias/actions";
import { FormResolver, FormTratar } from "@/features/ocorrencias/components/formularios";
import { obterOcorrencia } from "@/features/ocorrencias/queries";
import {
  ROTULO_PRIORIDADE,
  ROTULO_RESULTADO,
  ROTULO_STATUS_OCORRENCIA,
  ROTULO_TIPO_OCORRENCIA,
  TOM_PRIORIDADE,
  vencida,
} from "@/features/ocorrencias/rotulos";
import { opcoesResponsaveis } from "@/features/recebimentos/queries";
import { pode } from "@/lib/auth/autorizacao";
import { exigirContexto } from "@/lib/auth/contexto";
import { formatarDataHora, utcParaHorarioLocal } from "@/lib/format/datas";
import { formatarQuantidade } from "@/lib/format/moeda";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/comum";

export const metadata: Metadata = { title: "Ocorrência" };

const AVISOS = {
  registrada: "Ocorrência registrada.",
  tratamento: "Ocorrência em tratamento.",
  resolvida: "Ocorrência resolvida.",
  reaberta: "Ocorrência reaberta.",
  cancelada: "Ocorrência cancelada.",
} as const;

export default async function OcorrenciaPage({
  params,
  searchParams,
}: PageProps<"/ocorrencias/[id]">) {
  const contexto = await exigirContexto();
  const id = uuidSchema.safeParse((await params).id);
  const o = id.success ? await obterOcorrencia(contexto, id.data) : null;
  if (!o) notFound();
  const p = await searchParams;
  const aviso = (Object.keys(AVISOS) as (keyof typeof AVISOS)[]).find((k) => p[k]);
  const fuso = contexto.empresa.timezone;
  const emAberto = o.status === "ABERTA" || o.status === "EM_TRATAMENTO";
  const podeTratar = pode(contexto, "ocorrencia.tratar");
  const supabase = await createSupabaseServerClient();
  const [fotos, responsaveis, { data: responsavel }] = await Promise.all([
    evidenciasDe(contexto, "OCORRENCIA", [o.id]),
    podeTratar && emAberto ? opcoesResponsaveis(contexto) : Promise.resolve([]),
    o.responsavelId
      ? supabase.from("perfis_usuario").select("nome").eq("user_id", o.responsavelId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const alvoLink = o.bemId
    ? `/bens/${o.bemId}`
    : o.loteId
      ? `/bens/lotes/${o.loteId}`
      : `/locacoes/${o.locacaoId}`;
  const dados: [string, ReactNode][] = [
    [
      "Sobre",
      <Link key="a" href={alvoLink} className="text-primaria hover:underline">
        {o.alvo ?? `Locação ${o.locacao}`}
      </Link>,
    ],
    [
      "Locação",
      <Link key="l" href={`/locacoes/${o.locacaoId}`} className="text-primaria hover:underline">
        {o.locacao}
      </Link>,
    ],
    ["Quando aconteceu", formatarDataHora(o.dataEvento, fuso)],
    ["Prazo", o.prazo ? formatarDataHora(o.prazo, fuso) : "Sem prazo"],
    ["Responsável", responsavel?.nome ?? "Sem responsável"],
    ...(o.quantidade
      ? ([["Quantidade", formatarQuantidade(o.quantidade)]] as [string, ReactNode][])
      : []),
    ...(o.resultado
      ? ([["Resultado", `${ROTULO_RESULTADO[o.resultado]} — ${o.resolucao ?? ""}`]] as [
          string,
          ReactNode,
        ][])
      : []),
    ...(o.bemSubstitutoId
      ? ([
          [
            "Bem substituto",
            <Link
              key="s"
              href={`/bens/${o.bemSubstitutoId}`}
              className="text-primaria hover:underline"
            >
              abrir ficha
            </Link>,
          ],
        ] as [string, ReactNode][])
      : []),
    ...(o.reabertaEm
      ? ([
          ["Reaberta", `${formatarDataHora(o.reabertaEm, fuso)} · ${o.motivoReabertura ?? ""}`],
        ] as [string, ReactNode][])
      : []),
    ...(o.canceladaEm
      ? ([
          ["Cancelada", `${formatarDataHora(o.canceladaEm, fuso)} · ${o.motivoCancelamento ?? ""}`],
        ] as [string, ReactNode][])
      : []),
  ];

  return (
    <>
      <PageHeader titulo={`Ocorrência ${o.codigo}`} descricao={ROTULO_TIPO_OCORRENCIA[o.tipo]} />
      {aviso ? <Alert tom="sucesso" titulo={AVISOS[aviso]} className="mb-4" /> : null}
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge>{ROTULO_STATUS_OCORRENCIA[o.status]}</Badge>
        <Badge tom={TOM_PRIORIDADE[o.prioridade]}>
          Prioridade {ROTULO_PRIORIDADE[o.prioridade].toLowerCase()}
        </Badge>
        {vencida(o) ? <Badge tom="perigo">Vencida</Badge> : null}
      </div>
      <p className="mb-4 max-w-3xl break-words">{o.descricao}</p>
      <dl className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {dados.map(([t, v]) => (
          <div key={t} className="rounded-md border border-borda bg-superficie p-3">
            <dt className="text-sm text-texto-suave">{t}</dt>
            <dd className="font-medium break-words">{v}</dd>
          </div>
        ))}
      </dl>

      {emAberto && podeTratar ? (
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <section
            aria-labelledby="tratar"
            className="space-y-3 rounded-md border border-borda bg-superficie p-4"
          >
            <h2 id="tratar" className="text-lg font-semibold">
              Tratamento
            </h2>
            <FormTratar
              id={o.id}
              responsaveis={responsaveis}
              inicial={{
                responsavelId: o.responsavelId,
                prazoLocal: o.prazo ? utcParaHorarioLocal(o.prazo, fuso) : null,
              }}
            />
          </section>
          <section
            aria-labelledby="resolver"
            className="space-y-3 rounded-md border border-borda bg-superficie p-4"
          >
            <h2 id="resolver" className="text-lg font-semibold">
              Resolver
            </h2>
            <FormResolver id={o.id} tipo={o.tipo} />
          </section>
        </div>
      ) : null}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        {emAberto && podeTratar ? (
          <AcaoConfirmada
            acao={cancelarOcorrencia}
            campos={{ id: o.id }}
            rotulo="Cancelar ocorrência"
            variante="secundaria"
            perigoso
            titulo="Cancelar esta ocorrência?"
            descricao={
              o.alterouSituacao
                ? "O bem volta à situação anterior ao registro."
                : "Use quando o registro foi feito por engano."
            }
            rotuloConfirmar="Cancelar ocorrência"
            motivo={{ rotulo: "Motivo do cancelamento" }}
          />
        ) : null}
        {o.status === "RESOLVIDA" &&
        podeTratar &&
        !o.alterouSituacao &&
        o.tipo !== "TROCA" &&
        o.tipo !== "EXTRAVIO" ? (
          <AcaoConfirmada
            acao={reabrirOcorrencia}
            campos={{ id: o.id }}
            rotulo="Reabrir"
            variante="secundaria"
            titulo="Reabrir esta ocorrência?"
            descricao="A resolução anterior continua no histórico."
            rotuloConfirmar="Reabrir"
            motivo={{ rotulo: "Motivo da reabertura" }}
          />
        ) : null}
      </div>

      <section aria-labelledby="fotos" className="space-y-3">
        <h2 id="fotos" className="text-xl font-semibold">
          Fotos e documentos
        </h2>
        <GaleriaEvidencias
          evidencias={fotos}
          fuso={fuso}
          podeGerenciar={pode(contexto, "evidencia.substituir_remover")}
          caminho={`/ocorrencias/${o.id}`}
          entidadeTipo="OCORRENCIA"
        />
        {pode(contexto, "evidencia.enviar") ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            <EnviarArquivo
              entidadeTipo="OCORRENCIA"
              entidadeId={o.id}
              tipo="FOTO"
              rotulo="Adicionar foto"
            />
            <EnviarArquivo
              entidadeTipo="OCORRENCIA"
              entidadeId={o.id}
              tipo="DOCUMENTO"
              rotulo="Anexar documento"
            />
          </div>
        ) : null}
      </section>
    </>
  );
}
