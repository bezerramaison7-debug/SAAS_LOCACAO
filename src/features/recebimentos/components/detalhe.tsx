import Link from "next/link";

import { AcaoConfirmada } from "@/components/forms/acao-confirmada";
import { AcaoSimples } from "@/components/forms/acao-simples";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { GaleriaEvidencias } from "@/features/evidencias/components/galeria";
import { evidenciasDe } from "@/features/evidencias/queries";
import { pode } from "@/lib/auth/autorizacao";
import { type Contexto } from "@/lib/auth/contexto";
import { formatarDataHora } from "@/lib/format/datas";
import { formatarQuantidade } from "@/lib/format/moeda";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { autorizarExcesso, cancelarRecebimentoConfirmado, reabrirRecebimento } from "../actions";
import { excessoRecebimento, linhasRecebimento, type Recebimento } from "../queries";
import { ROTULO_CONDICAO } from "../rotulos";
import { rotuloLinha } from "./conteudo-etapa";

export async function DetalheRecebimento({
  contexto,
  recebimento,
}: {
  contexto: Contexto;
  recebimento: Recebimento;
}) {
  const fuso = contexto.empresa.timezone;
  const supabase = await createSupabaseServerClient();
  const linhas = await linhasRecebimento(contexto, recebimento.id);
  const [excesso, fotos, { data: vistorias }, { data: ocorrencias }, { data: responsavel }] =
    await Promise.all([
      recebimento.status === "AGUARDANDO_AUTORIZACAO"
        ? excessoRecebimento(recebimento.id)
        : Promise.resolve([]),
      evidenciasDe(
        contexto,
        "ITEM_RECEBIMENTO",
        linhas.map((l) => l.id),
      ),
      supabase
        .from("vistorias")
        .select("id, status, item_recebimento_id")
        .eq("evento_origem_tipo", "RECEBIMENTO")
        .eq("evento_origem_id", recebimento.id)
        .neq("status", "CANCELADA"),
      supabase
        .from("ocorrencias")
        .select("id, codigo, tipo, status")
        .eq("recebimento_id", recebimento.id),
      recebimento.responsavelId
        ? supabase
            .from("perfis_usuario")
            .select("nome")
            .eq("user_id", recebimento.responsavelId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
  const vistoriaDa = new Map((vistorias ?? []).map((v) => [v.item_recebimento_id, v]));
  const podeGerenciarFotos = pode(contexto, "evidencia.substituir_remover");

  return (
    <div className="space-y-6">
      {recebimento.status === "AGUARDANDO_AUTORIZACAO" ? (
        <section aria-labelledby="excesso" className="space-y-3">
          <Alert tom="alerta" titulo="Quantidade acima do contratado (RN-25)">
            <ul id="excesso" className="mt-1 list-disc pl-5">
              {excesso.map((e) => (
                <li key={e.descricao}>
                  {e.descricao}: contratado {formatarQuantidade(e.contratada)}, já recebido{" "}
                  {formatarQuantidade(e.jaRecebida)}, neste recebimento{" "}
                  {formatarQuantidade(e.agora)} — excesso de {formatarQuantidade(e.excesso)}
                </li>
              ))}
            </ul>
          </Alert>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            {pode(contexto, "recebimento.autorizar_excesso") ? (
              <AcaoConfirmada
                acao={autorizarExcesso}
                campos={{ id: recebimento.id }}
                rotulo="Autorizar e confirmar"
                titulo="Autorizar o recebimento acima do contratado?"
                descricao="O recebimento será confirmado e uma ocorrência de divergência de quantidade ficará aberta para tratamento."
                rotuloConfirmar="Autorizar"
                motivo={{ rotulo: "Justificativa da autorização" }}
              />
            ) : null}
            {pode(contexto, "recebimento.registrar") ? (
              <AcaoSimples
                acao={reabrirRecebimento}
                campos={{ id: recebimento.id }}
                rotulo="Voltar ao rascunho para corrigir"
                variante="secundaria"
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {recebimento.status === "CANCELADO" ? (
        <Alert tom="info" titulo="Recebimento cancelado">
          {recebimento.motivoCancelamento}
        </Alert>
      ) : null}

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [
            "Data do recebimento",
            recebimento.dataEvento ? formatarDataHora(recebimento.dataEvento, fuso) : "—",
          ],
          ["Local", recebimento.local ?? "—"],
          ["Responsável", responsavel?.nome ?? "—"],
          [
            "Confirmado em",
            recebimento.confirmadoEm ? formatarDataHora(recebimento.confirmadoEm, fuso) : "—",
          ],
        ].map(([t, v]) => (
          <div key={t} className="rounded-md border border-borda bg-superficie p-3">
            <dt className="text-sm text-texto-suave">{t}</dt>
            <dd className="font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      {recebimento.excessoJustificativa ? (
        <p className="text-texto-suave">Excesso autorizado: {recebimento.excessoJustificativa}</p>
      ) : null}

      <section aria-labelledby="itens-recebidos" className="space-y-3">
        <h2 id="itens-recebidos" className="text-xl font-semibold">
          Itens recebidos
        </h2>
        <ul className="space-y-3">
          {linhas.map((l) => {
            const v = vistoriaDa.get(l.id);
            return (
              <li key={l.id} className="space-y-2 rounded-md border border-borda bg-superficie p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {l.bem && recebimento.status === "CONFIRMADO" ? (
                    <Link
                      href={`/bens/${l.bem.id}`}
                      className="font-medium text-primaria hover:underline"
                    >
                      {rotuloLinha(l)}
                    </Link>
                  ) : l.loteId ? (
                    <Link
                      href={`/bens/lotes/${l.loteId}`}
                      className="font-medium text-primaria hover:underline"
                    >
                      {l.loteCodigo} — {rotuloLinha(l)}
                    </Link>
                  ) : (
                    <span className="font-medium">{rotuloLinha(l)}</span>
                  )}
                  <Badge tom={l.condicao === "AVARIADO" ? "perigo" : "neutro"}>
                    {ROTULO_CONDICAO[l.condicao]}
                  </Badge>
                </div>
                {l.observacao ? <p className="text-sm text-texto-suave">{l.observacao}</p> : null}
                {v ? (
                  <Link
                    href={`/vistorias/${v.id}`}
                    className="inline-block text-sm text-primaria hover:underline"
                  >
                    Vistoria de entrada ({v.status === "CONCLUIDA" ? "concluída" : "em andamento"})
                  </Link>
                ) : null}
                <GaleriaEvidencias
                  evidencias={fotos.filter((f) => f.entidadeId === l.id)}
                  fuso={fuso}
                  podeGerenciar={podeGerenciarFotos}
                  caminho={`/recebimentos/${recebimento.id}`}
                  entidadeTipo="ITEM_RECEBIMENTO"
                />
              </li>
            );
          })}
        </ul>
      </section>

      {ocorrencias?.length ? (
        <section aria-labelledby="ocorrencias" className="space-y-2">
          <h2 id="ocorrencias" className="text-xl font-semibold">
            Ocorrências geradas
          </h2>
          <ul className="space-y-1">
            {ocorrencias.map((o) => (
              <li key={o.id}>
                <span className="font-mono">{o.codigo}</span> —{" "}
                {o.tipo === "AVARIA" ? "Avaria" : "Divergência de quantidade"} (
                {o.status.toLowerCase()})
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {recebimento.status === "CONFIRMADO" && pode(contexto, "recebimento.cancelar_confirmado") ? (
        <AcaoConfirmada
          acao={cancelarRecebimentoConfirmado}
          campos={{ id: recebimento.id }}
          rotulo="Cancelar recebimento"
          variante="secundaria"
          perigoso
          titulo={`Cancelar o recebimento ${recebimento.codigo}?`}
          descricao="Só é possível se nenhum bem ou lote dele teve evento posterior. Bens e lotes passam a cancelados. Não pode ser desfeito."
          rotuloConfirmar="Cancelar recebimento"
          motivo={{ rotulo: "Motivo do cancelamento" }}
        />
      ) : null}
    </div>
  );
}
