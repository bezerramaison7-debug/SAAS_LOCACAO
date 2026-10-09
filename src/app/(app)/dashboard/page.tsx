import { AlertTriangle, CalendarClock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { cn } from "@/components/ui/cn";
import { PageHeader } from "@/components/ui/page-header";
import { ROTULO_TIPO_OCORRENCIA } from "@/features/ocorrencias/rotulos";
import { indicadoresDoPainel, type Indicador } from "@/features/painel/indicadores";
import { exigirContexto } from "@/lib/auth/contexto";
import { formatarDataCivil, formatarDataHora } from "@/lib/format/datas";

export const metadata: Metadata = { title: "Painel" };

const BORDA_TOM: Record<Indicador["tom"], string> = {
  neutro: "border-borda",
  alerta: "border-alerta",
  perigo: "border-perigo",
};

/** F8.1: cada indicador mostra a regra de cálculo e abre a lista já filtrada. */
function Cartao({ indicador }: { indicador: Indicador }) {
  const idRegra = `regra-${indicador.id}`;
  return (
    <li>
      <Link
        href={indicador.href}
        aria-describedby={idRegra}
        data-indicador={indicador.id}
        className={cn(
          "flex h-full min-h-28 flex-col gap-1 rounded-md border-2 bg-superficie p-4 hover:border-primaria focus-visible:border-primaria",
          BORDA_TOM[indicador.tom],
        )}
      >
        <span className="font-medium">{indicador.titulo}</span>
        <span className="text-3xl font-semibold tabular-nums" data-valor>
          {indicador.valor}
        </span>
        <span id={idRegra} className="text-sm text-texto-suave">
          Regra: {indicador.regra}
        </span>
      </Link>
    </li>
  );
}

export default async function DashboardPage() {
  const contexto = await exigirContexto();
  const { grupos, alertas } = await indicadoresDoPainel(contexto);
  const fuso = contexto.empresa.timezone;

  return (
    <>
      <PageHeader
        titulo="Painel"
        descricao="Indicadores com regra de cálculo explícita. Cada número abre a lista correspondente."
      />
      {alertas.terminos.length || alertas.ocorrencias.length ? (
        <section aria-labelledby="alertas" className="mb-8 grid gap-4 lg:grid-cols-2">
          <h2 id="alertas" className="sr-only">
            Alertas
          </h2>
          {alertas.terminos.length ? (
            <div className="rounded-md border border-alerta bg-superficie p-4">
              <h3 className="mb-2 flex items-center gap-2 font-semibold">
                <CalendarClock aria-hidden className="size-5" /> Locações terminando em até 7 dias
              </h3>
              <ul className="space-y-1">
                {alertas.terminos.map((l) => (
                  <li key={l.id}>
                    <Link href={`/locacoes/${l.id}`} className="font-mono text-primaria underline">
                      {l.codigo}
                    </Link>{" "}
                    · {l.fornecedor ?? "—"} · término{" "}
                    {l.terminoPrevisto ? formatarDataCivil(l.terminoPrevisto) : "—"}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {alertas.ocorrencias.length ? (
            <div className="rounded-md border border-perigo bg-superficie p-4">
              <h3 className="mb-2 flex items-center gap-2 font-semibold">
                <AlertTriangle aria-hidden className="size-5" /> Ocorrências vencidas
              </h3>
              <ul className="space-y-1">
                {alertas.ocorrencias.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/ocorrencias/${o.id}`}
                      className="font-mono text-primaria underline"
                    >
                      {o.codigo}
                    </Link>{" "}
                    · {ROTULO_TIPO_OCORRENCIA[o.tipo]} · {o.alvo ?? `locação ${o.locacao}`} · prazo{" "}
                    {o.prazo ? formatarDataHora(o.prazo, fuso) : "—"}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
      {grupos.map((g) => (
        <section key={g.titulo} aria-labelledby={`grupo-${g.titulo}`} className="mb-8">
          <h2 id={`grupo-${g.titulo}`} className="mb-3 text-xl font-semibold">
            {g.titulo}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {g.itens.map((i) => (
              <Cartao key={i.id} indicador={i} />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
