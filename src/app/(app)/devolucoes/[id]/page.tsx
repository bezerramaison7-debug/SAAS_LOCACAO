import { ClipboardCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AcaoConfirmada } from "@/components/forms/acao-confirmada";
import { AcaoSimples } from "@/components/forms/acao-simples";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import {
  cancelarDevolucao,
  conferirDevolucao,
  darCiencia,
  iniciarVistoriaSaida,
} from "@/features/devolucoes/actions";
import { FormAgendamento } from "@/features/devolucoes/components/form-agendamento";
import { FormRetirada } from "@/features/devolucoes/components/form-retirada";
import { obterDevolucao } from "@/features/devolucoes/queries";
import { EnviarArquivo } from "@/features/evidencias/components/enviar-arquivo";
import { GaleriaEvidencias } from "@/features/evidencias/components/galeria";
import { evidenciasDe } from "@/features/evidencias/queries";
import { ROTULO_STATUS_DEVOLUCAO, rotulo } from "@/features/locacoes/rotulos-eventos";
import { ROTULO_CONDICAO } from "@/features/recebimentos/rotulos";
import { exigirPermissaoPagina, pode } from "@/lib/auth/autorizacao";
import { exigirContexto } from "@/lib/auth/contexto";
import { formatarDataHora, utcParaHorarioLocal } from "@/lib/format/datas";
import { formatarQuantidade } from "@/lib/format/moeda";
import { uuidSchema } from "@/lib/validation/comum";

export const metadata: Metadata = { title: "Devolução" };

const AVISOS = {
  solicitada: "Devolução solicitada. Os itens ficam reservados até a retirada.",
  agendada: "Retirada agendada.",
  retirada: "Retirada confirmada: saldo atualizado. Anexe o comprovante para conferir.",
  conferida: "Devolução conferida.",
  cancelada: "Devolução cancelada: os itens voltaram à situação anterior.",
  ciencia: "Ciência financeira registrada.",
} as const;

export default async function DevolucaoPage({
  params,
  searchParams,
}: PageProps<"/devolucoes/[id]">) {
  const contexto = await exigirContexto();
  exigirPermissaoPagina(contexto, "dados.ler_geral");
  const id = uuidSchema.safeParse((await params).id);
  const d = id.success ? await obterDevolucao(contexto, id.data) : null;
  if (!d) notFound();
  const p = await searchParams;
  const aviso = (Object.keys(AVISOS) as (keyof typeof AVISOS)[]).find((k) => p[k]);
  const fuso = contexto.empresa.timezone;
  const data = (v: string | null) => (v ? formatarDataHora(v, fuso) : "—");
  const aberta = d.status === "SOLICITADA" || d.status === "AGENDADA";
  const retirada = d.status === "RETIRADA_CONFIRMADA" || d.status === "CONFERIDA";
  const gerencia = pode(contexto, "devolucao.gerenciar");
  const comprovantes = retirada ? await evidenciasDe(contexto, "DEVOLUCAO", [d.id]) : [];
  const temComprovante = comprovantes.some((e) => e.tipo === "COMPROVANTE");
  const itensAtivos = d.itens.filter((i) => i.ativo);
  const semVistoria = itensAtivos.filter((i) => i.exigeVistoria && !i.vistoria?.concluida);

  return (
    <>
      <PageHeader titulo={`Devolução ${d.codigo}`} descricao={`Locação ${d.locacao}`} />
      {aviso ? <Alert tom="sucesso" titulo={AVISOS[aviso]} className="mb-4" /> : null}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tom={d.status === "CANCELADA" ? "neutro" : retirada ? "sucesso" : "alerta"}>
          {rotulo(ROTULO_STATUS_DEVOLUCAO, d.status)}
        </Badge>
        {retirada && !d.cienciaEm ? (
          <Badge tom="alerta">Aguardando ciência financeira</Badge>
        ) : null}
        {retirada && !temComprovante ? <Badge tom="alerta">Sem comprovante</Badge> : null}
      </div>
      <dl className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(
          [
            [
              "Locação",
              <Link
                key="l"
                href={`/locacoes/${d.locacaoId}`}
                className="text-primaria hover:underline"
              >
                {d.locacao}
              </Link>,
            ],
            [
              "Solicitada",
              `${data(d.solicitadaEm)}${d.solicitadaPor ? ` · ${d.solicitadaPor}` : ""}`,
            ],
            ["Agendada para", data(d.agendadaPara)],
            [
              "Retirada",
              `${data(d.retiradaEm)}${d.retiradaConfirmadaPor ? ` · registrada por ${d.retiradaConfirmadaPor}` : ""}`,
            ],
            ["Recebido pelo fornecedor por", d.recebedor ?? "—"],
            ["Conferida", `${data(d.conferidaEm)}${d.conferidaPor ? ` · ${d.conferidaPor}` : ""}`],
            [
              "Ciência financeira",
              `${data(d.cienciaEm)}${d.cienciaPor ? ` · ${d.cienciaPor}` : ""}`,
            ],
            ...(d.observacoes ? [["Observações", d.observacoes] as [string, string]] : []),
            ...(d.motivoCancelamento
              ? [["Motivo do cancelamento", d.motivoCancelamento] as [string, string]]
              : []),
          ] as [string, React.ReactNode][]
        ).map(([t, v]) => (
          <div key={t} className="rounded-md border border-borda bg-superficie p-3">
            <dt className="text-sm text-texto-suave">{t}</dt>
            <dd className="font-medium break-words">{v}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="itens" className="mb-6 space-y-3">
        <h2 id="itens" className="text-xl font-semibold">
          Itens
        </h2>
        <ul className="space-y-3">
          {d.itens.map((i) => (
            <li key={i.id} className="space-y-2 rounded-md border border-borda bg-superficie p-3">
              <p>
                <Link
                  href={i.bemId ? `/bens/${i.bemId}` : `/bens/lotes/${i.loteId}`}
                  className="font-mono font-medium text-primaria hover:underline"
                >
                  {i.rotulo}
                </Link>{" "}
                · {i.descricao}
              </p>
              <p className="text-sm text-texto-suave">
                Solicitado: {formatarQuantidade(i.solicitada)} {i.unidade}
                {i.retirada !== null
                  ? ` · Retirado: ${formatarQuantidade(i.retirada)} ${i.unidade}`
                  : ""}
                {i.condicao ? ` · Condição: ${ROTULO_CONDICAO[i.condicao]}` : ""}
                {!i.ativo && d.status !== "CANCELADA"
                  ? " · não saiu (voltou à situação anterior)"
                  : ""}
              </p>
              {i.exigeVistoria && (i.ativo || i.vistoria) ? (
                i.vistoria ? (
                  <Link
                    href={`/vistorias/${i.vistoria.id}`}
                    className="text-primaria hover:underline"
                  >
                    Vistoria de saída {i.vistoria.concluida ? "(concluída)" : "(em andamento)"}
                  </Link>
                ) : aberta && pode(contexto, "vistoria.registrar") ? (
                  <AcaoSimples
                    acao={iniciarVistoriaSaida}
                    campos={{ itemId: i.id }}
                    rotulo={
                      <>
                        <ClipboardCheck aria-hidden /> Fazer vistoria de saída
                      </>
                    }
                    variante="secundaria"
                    pendente="Abrindo…"
                  />
                ) : (
                  <p className="text-sm text-texto-suave">Vistoria de saída pendente.</p>
                )
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {aberta && gerencia ? (
        <>
          <section aria-labelledby="agendamento" className="mb-6 max-w-xl space-y-3">
            <h2 id="agendamento" className="text-xl font-semibold">
              {d.status === "AGENDADA" ? "Reagendar retirada" : "Agendar retirada"}
            </h2>
            <FormAgendamento
              id={d.id}
              reagendar={d.status === "AGENDADA"}
              inicial={utcParaHorarioLocal(d.agendadaPara ?? new Date(), fuso)}
            />
          </section>
          <section aria-labelledby="retirada" className="mb-6 max-w-3xl space-y-3">
            <h2 id="retirada" className="text-xl font-semibold">
              Confirmar retirada
            </h2>
            {semVistoria.length ? (
              <Alert tom="alerta" titulo="Vistoria de saída pendente">
                Conclua a vistoria de {semVistoria.map((i) => i.rotulo).join(", ")} ou informe
                quantidade 0 para o que não sair.
              </Alert>
            ) : null}
            <FormRetirada
              id={d.id}
              imediata={d.status === "SOLICITADA"}
              agoraLocal={utcParaHorarioLocal(new Date(), fuso)}
              itens={itensAtivos.map((i) => ({
                id: i.id,
                rotulo: i.rotulo,
                descricao: i.descricao,
                unidade: i.unidade,
                solicitada: i.solicitada,
                lote: Boolean(i.loteId),
              }))}
            />
          </section>
          <AcaoConfirmada
            acao={cancelarDevolucao}
            campos={{ id: d.id }}
            rotulo="Cancelar devolução"
            variante="secundaria"
            perigoso
            titulo={`Cancelar a devolução ${d.codigo}?`}
            descricao="Os bens voltam à situação anterior e as quantidades de lote deixam de estar reservadas."
            rotuloConfirmar="Cancelar devolução"
            motivo={{ rotulo: "Motivo do cancelamento" }}
          />
        </>
      ) : null}

      {retirada ? (
        <section aria-labelledby="comprovante" className="space-y-3">
          <h2 id="comprovante" className="text-xl font-semibold">
            Comprovante de retirada
          </h2>
          <GaleriaEvidencias
            evidencias={comprovantes}
            fuso={fuso}
            podeGerenciar={pode(contexto, "evidencia.substituir_remover")}
            caminho={`/devolucoes/${d.id}`}
            entidadeTipo="DEVOLUCAO"
          />
          {pode(contexto, "evidencia.enviar") ? (
            <EnviarArquivo
              entidadeTipo="DEVOLUCAO"
              entidadeId={d.id}
              tipo="COMPROVANTE"
              rotulo="Anexar comprovante"
            />
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            {d.status === "RETIRADA_CONFIRMADA" && gerencia ? (
              temComprovante ? (
                <AcaoSimples
                  acao={conferirDevolucao}
                  campos={{ id: d.id }}
                  rotulo="Conferir devolução"
                  pendente="Conferindo…"
                />
              ) : (
                <p className="text-sm text-texto-suave">
                  Anexe o comprovante para conferir a devolução.
                </p>
              )
            ) : null}
            {!d.cienciaEm && pode(contexto, "devolucao.ciencia_financeira") ? (
              <AcaoSimples
                acao={darCiencia}
                campos={{ id: d.id }}
                rotulo="Registrar ciência financeira"
                variante="secundaria"
                pendente="Registrando…"
              />
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  );
}
