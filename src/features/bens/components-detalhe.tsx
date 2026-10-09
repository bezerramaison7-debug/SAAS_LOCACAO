import Link from "next/link";
import { type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { EnviarArquivo } from "@/features/evidencias/components/enviar-arquivo";
import { GaleriaEvidencias } from "@/features/evidencias/components/galeria";
import { type Evidencia } from "@/features/evidencias/queries";
import { ROTULO_TIPO_VISTORIA } from "@/features/vistorias/rotulos";
import { pode } from "@/lib/auth/autorizacao";
import { type Contexto } from "@/lib/auth/contexto";
import { formatarDataHora } from "@/lib/format/datas";

type Vistoria = { id: string; tipo: string; status: string; dataEvento: string; checklist: string };

/** Conteúdo comum do detalhe de bem e de lote. */
export function DetalheAtivo({
  contexto,
  dados,
  vistorias,
  fotos,
  fotosRecebimento,
  entidade,
  entidadeId,
  caminho,
  cabecalho,
  linhaDoTempo,
}: {
  contexto: Contexto;
  dados: [string, ReactNode][];
  vistorias: Vistoria[];
  fotos: Evidencia[];
  fotosRecebimento: Evidencia[];
  entidade: "BEM" | "LOTE";
  entidadeId: string;
  caminho: string;
  /** Alertas e ações da ficha (F6.3). */
  cabecalho: ReactNode;
  linhaDoTempo: ReactNode;
}) {
  const fuso = contexto.empresa.timezone;
  const podeGerenciar = pode(contexto, "evidencia.substituir_remover");
  return (
    <div className="space-y-6">
      {cabecalho}
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {dados.map(([t, v]) => (
          <div key={t} className="rounded-md border border-borda bg-superficie p-3">
            <dt className="text-sm text-texto-suave">{t}</dt>
            <dd className="font-medium break-words">{v}</dd>
          </div>
        ))}
      </dl>
      <section aria-labelledby="historico" className="space-y-3">
        <h2 id="historico" className="text-xl font-semibold">
          Linha do tempo
        </h2>
        {linhaDoTempo}
      </section>
      <section aria-labelledby="vistorias" className="space-y-2">
        <h2 id="vistorias" className="text-xl font-semibold">
          Vistorias
        </h2>
        {vistorias.length ? (
          <ul className="space-y-1">
            {vistorias.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-2">
                <Link href={`/vistorias/${v.id}`} className="text-primaria hover:underline">
                  {ROTULO_TIPO_VISTORIA[v.tipo] ?? v.tipo} — {formatarDataHora(v.dataEvento, fuso)}
                </Link>
                <Badge tom={v.status === "CONCLUIDA" ? "sucesso" : "alerta"}>
                  {v.status === "CONCLUIDA" ? "Concluída" : "Rascunho"}
                </Badge>
                <span className="text-sm text-texto-suave">{v.checklist}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-texto-suave">Nenhuma vistoria registrada.</p>
        )}
      </section>
      <section aria-labelledby="fotos" className="space-y-3">
        <h2 id="fotos" className="text-xl font-semibold">
          Fotos e documentos
        </h2>
        <GaleriaEvidencias
          evidencias={fotos}
          fuso={fuso}
          podeGerenciar={podeGerenciar}
          caminho={caminho}
          entidadeTipo={entidade}
        />
        {pode(contexto, "evidencia.enviar") ? (
          <EnviarArquivo
            entidadeTipo={entidade}
            entidadeId={entidadeId}
            tipo="FOTO"
            rotulo="Adicionar foto"
          />
        ) : null}
      </section>
      {fotosRecebimento.length ? (
        <section aria-labelledby="fotos-recebimento" className="space-y-3">
          <h2 id="fotos-recebimento" className="text-xl font-semibold">
            Fotos do recebimento
          </h2>
          <GaleriaEvidencias
            evidencias={fotosRecebimento}
            fuso={fuso}
            podeGerenciar={false}
            caminho={caminho}
            entidadeTipo="ITEM_RECEBIMENTO"
          />
        </section>
      ) : null}
    </div>
  );
}
