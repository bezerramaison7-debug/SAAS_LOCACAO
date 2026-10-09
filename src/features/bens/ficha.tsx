import { AlertTriangle, ArrowLeftRight, ClipboardCheck, QrCode, Repeat } from "lucide-react";
import Link from "next/link";

import { AcaoSimples } from "@/components/forms/acao-simples";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ocorrenciasAbertasDe } from "@/features/ocorrencias/queries";
import { ROTULO_TIPO_OCORRENCIA, vencida } from "@/features/ocorrencias/rotulos";
import { pode } from "@/lib/auth/autorizacao";
import { type Contexto } from "@/lib/auth/contexto";
import { qrDataUri } from "@/lib/qr/qr";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { BotaoRelatorio } from "@/features/relatorios/components/botao-relatorio";

import { iniciarVistoriaPeriodica } from "./actions";

const MOVIMENTAVEIS_BEM = ["DISPONIVEL", "EM_USO"];
// Espelha public.status_bem_ativo (rpc_iniciar_vistoria recusa os demais).
const VISTORIAVEIS_BEM = [
  "DISPONIVEL",
  "EM_USO",
  "EM_TRANSFERENCIA",
  "EM_MANUTENCAO",
  "DEVOLUCAO_SOLICITADA",
  "EXTRAVIADO",
];

/**
 * Alertas (pendências que pedem ação) e ações contextuais da ficha do bem ou
 * do lote. Só aparecem ações executáveis na situação atual (sem botões mortos);
 * o banco revalida tudo.
 */
export async function CabecalhoFicha({
  contexto,
  alvo,
}: {
  contexto: Contexto;
  alvo: { tipo: "bem" | "lote"; id: string; status: string; temChecklist: boolean };
}) {
  const supabase = await createSupabaseServerClient();
  const filtro = alvo.tipo === "bem" ? { bem: alvo.id } : { lote: alvo.id };
  const coluna = alvo.tipo === "bem" ? "bem_id" : "lote_id";
  const [ocorrencias, { data: pendentes }, { data: rascunhos }] = await Promise.all([
    ocorrenciasAbertasDe(contexto, filtro),
    supabase
      .from("movimentacoes")
      .select("id, codigo")
      .eq(coluna, alvo.id)
      .eq("status", "PENDENTE_ACEITE"),
    supabase.from("vistorias").select("id, tipo").eq(coluna, alvo.id).eq("status", "RASCUNHO"),
  ]);
  const { data: devolucoes } = await supabase
    .from("itens_devolucao")
    .select("devolucoes!inner(id, codigo, status)")
    .eq(coluna, alvo.id)
    .eq("ativo", true)
    .in("devolucoes.status", ["SOLICITADA", "AGENDADA"]);
  const ativo =
    alvo.tipo === "bem" ? MOVIMENTAVEIS_BEM.includes(alvo.status) : alvo.status === "ATIVO";
  const param = alvo.tipo === "bem" ? `bem=${alvo.id}` : `lote=${alvo.id}`;
  const etiqueta = `/etiquetas/${alvo.tipo}/${alvo.id}` as const;
  const qr = await qrDataUri(alvo.id);

  return (
    <div className="space-y-3">
      {(pendentes ?? []).map((m) => (
        <Alert key={m.id} tom="alerta" titulo={`Transferência ${m.codigo} aguardando aceite`}>
          <Link href={`/movimentacoes/${m.id}`} className="text-primaria hover:underline">
            Ver movimentação
          </Link>
        </Alert>
      ))}
      {ocorrencias.map((o) => (
        <Alert
          key={o.id}
          tom={vencida(o) ? "perigo" : "alerta"}
          titulo={`${ROTULO_TIPO_OCORRENCIA[o.tipo]} ${o.codigo}${vencida(o) ? " — vencida" : " em aberto"}`}
        >
          <Link href={`/ocorrencias/${o.id}`} className="text-primaria hover:underline">
            Ver ocorrência
          </Link>
        </Alert>
      ))}
      {(devolucoes ?? []).map(({ devolucoes: d }) => (
        <Alert key={d.id} tom="info" titulo={`Devolução ${d.codigo} aguardando retirada`}>
          <Link href={`/devolucoes/${d.id}`} className="text-primaria hover:underline">
            Ver devolução
          </Link>
        </Alert>
      ))}
      {(rascunhos ?? []).map((v) => (
        <Alert
          key={v.id}
          tom="info"
          titulo={v.tipo === "ENTRADA" ? "Vistoria de entrada pendente" : "Vistoria em andamento"}
        >
          <Link href={`/vistorias/${v.id}`} className="text-primaria hover:underline">
            Abrir vistoria
          </Link>
        </Alert>
      ))}
      <div className="flex flex-wrap gap-2">
        {ativo && !pendentes?.length && pode(contexto, "movimentacao.registrar") ? (
          <Button asChild variante="primaria">
            <Link href={`/movimentacoes/nova?${param}`}>
              <ArrowLeftRight aria-hidden /> Movimentar
            </Link>
          </Button>
        ) : null}
        {pode(contexto, "ocorrencia.registrar") && contexto.papel !== "FINANCEIRO" ? (
          <Button asChild variante="secundaria">
            <Link href={`/ocorrencias/nova?${param}`}>
              <AlertTriangle aria-hidden /> Registrar ocorrência
            </Link>
          </Button>
        ) : null}
        {alvo.tipo === "bem" &&
        ["DISPONIVEL", "EM_USO", "EM_MANUTENCAO"].includes(alvo.status) &&
        !pendentes?.length &&
        pode(contexto, "troca.registrar") ? (
          <Button asChild variante="secundaria">
            <Link href={`/bens/${alvo.id}/troca`}>
              <Repeat aria-hidden /> Registrar troca
            </Link>
          </Button>
        ) : null}
        {alvo.temChecklist &&
        !rascunhos?.length &&
        pode(contexto, "vistoria.registrar") &&
        (alvo.tipo === "lote" ? ativo : VISTORIAVEIS_BEM.includes(alvo.status)) ? (
          <AcaoSimples
            acao={iniciarVistoriaPeriodica}
            campos={alvo.tipo === "bem" ? { bemId: alvo.id } : { loteId: alvo.id }}
            rotulo={
              <>
                <ClipboardCheck aria-hidden /> Vistoria periódica
              </>
            }
            variante="secundaria"
            pendente="Abrindo…"
          />
        ) : null}
        {alvo.tipo === "bem" && pode(contexto, "relatorio.gerar") ? (
          <BotaoRelatorio tipo="BEM" alvo={alvo.id} />
        ) : null}
        <Button asChild variante="secundaria">
          <Link href={etiqueta} target="_blank">
            <QrCode aria-hidden /> Etiqueta com QR Code
          </Link>
        </Button>
      </div>
      <details className="rounded-md border border-borda bg-superficie p-3">
        <summary className="min-h-11 cursor-pointer content-center font-medium">
          QR Code desta ficha
        </summary>
        {/* eslint-disable-next-line @next/next/no-img-element -- data URI gerada no servidor */}
        <img
          src={qr}
          alt="QR Code que abre esta ficha"
          width={160}
          height={160}
          className="mt-2 size-40 bg-white p-1"
        />
      </details>
    </div>
  );
}
