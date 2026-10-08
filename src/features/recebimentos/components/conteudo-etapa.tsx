import { ArrowRight, CheckCircle2, ClipboardCheck } from "lucide-react";
import Link from "next/link";

import { AcaoConfirmada } from "@/components/forms/acao-confirmada";
import { AcaoSimples } from "@/components/forms/acao-simples";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { descreverExigeFoto, type ExigeFoto } from "@/features/cadastros/checklists/schemas";
import { opcoesLocais } from "@/features/cadastros/locais/queries";
import { EnviarArquivo } from "@/features/evidencias/components/enviar-arquivo";
import { GaleriaEvidencias } from "@/features/evidencias/components/galeria";
import { evidenciasDe } from "@/features/evidencias/queries";
import { pode } from "@/lib/auth/autorizacao";
import { type Contexto } from "@/lib/auth/contexto";
import { utcParaHorarioLocal } from "@/lib/format/datas";
import { formatarQuantidade } from "@/lib/format/moeda";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  confirmarRecebimento,
  descartarRecebimento,
  iniciarVistoria,
  removerLinha,
} from "../actions";
import {
  excessoRecebimento,
  itensContratados,
  linhasRecebimento,
  opcoesResponsaveis,
  pendenciasRecebimento,
  vistoriasDasLinhas,
  type ItemContratado,
  type LinhaRecebimento,
  type Recebimento,
} from "../queries";
import {
  ETAPAS_RECEBIMENTO,
  ROTULO_CONDICAO,
  ROTULO_ETAPA_RECEBIMENTO,
  type EtapaRecebimento,
} from "../rotulos";
import { FormDestino } from "./form-destino";
import { FormEditarBem, FormLote, FormNovoBem } from "./form-item";
import { FormVistoria, type PerguntaVistoria } from "./form-vistoria";

type Props = {
  contexto: Contexto;
  recebimento: Recebimento;
  etapa: EtapaRecebimento;
  linhaSelecionada: string | undefined;
};

function Proxima({ id, etapa }: { id: string; etapa: EtapaRecebimento }) {
  const proxima = ETAPAS_RECEBIMENTO[ETAPAS_RECEBIMENTO.indexOf(etapa) + 1];
  if (!proxima) return null;
  return (
    <Button asChild variante="primaria">
      <Link href={`/recebimentos/${id}?etapa=${proxima}`}>
        Continuar: {ROTULO_ETAPA_RECEBIMENTO[proxima]} <ArrowRight aria-hidden />
      </Link>
    </Button>
  );
}

export function rotuloLinha(l: LinhaRecebimento): string {
  if (!l.bem) return `${l.descricao} — ${formatarQuantidade(l.quantidade)} ${l.unidade}`;
  const ident = l.bem.numeroSerie ?? l.bem.placa ?? l.bem.identificacaoFornecedor;
  return `${l.bem.codigo}${ident ? ` (${ident})` : ""} — ${l.descricao}`;
}

function quantidadeNeste(item: ItemContratado, linhas: LinhaRecebimento[]): string {
  const doItem = linhas.filter((l) => l.itemLocacaoId === item.id);
  return item.modoControle === "INDIVIDUAL"
    ? String(doItem.length)
    : formatarQuantidade(doItem[0]?.quantidade ?? "0");
}

export async function ConteudoEtapa({ contexto, recebimento, etapa, linhaSelecionada }: Props) {
  const id = recebimento.id;
  const caminho = `/recebimentos/${id}`;
  const fuso = contexto.empresa.timezone;
  const [itens, linhas] = await Promise.all([
    itensContratados(contexto, recebimento.locacaoId),
    linhasRecebimento(contexto, id),
  ]);
  const itemDe = new Map(itens.map((i) => [i.id, i]));

  switch (etapa) {
    case "itens":
      return (
        <div className="space-y-4">
          {itens.map((item) => {
            const doItem = linhas.filter((l) => l.itemLocacaoId === item.id);
            const exige = {
              exigeNumeroSerie: item.exigeNumeroSerie,
              exigePlaca: item.exigePlaca,
              exigeIdentFornecedor: item.exigeIdentFornecedor,
            };
            return (
              <section
                key={item.id}
                aria-labelledby={`item-${item.id}`}
                className="space-y-3 rounded-md border border-borda bg-superficie p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 id={`item-${item.id}`} className="text-lg font-semibold">
                    {item.descricao}
                  </h3>
                  <Badge tom={item.modoControle === "INDIVIDUAL" ? "info" : "neutro"}>
                    {item.modoControle === "INDIVIDUAL" ? "Individual" : "Lote"}
                  </Badge>
                </div>
                <dl className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-texto-suave">Contratado</dt>
                    <dd className="font-semibold">{formatarQuantidade(item.contratada)}</dd>
                  </div>
                  <div>
                    <dt className="text-texto-suave">Já recebido</dt>
                    <dd className="font-semibold">{formatarQuantidade(item.recebida)}</dd>
                  </div>
                  <div>
                    <dt className="text-texto-suave">Neste recebimento</dt>
                    <dd className="font-semibold">{quantidadeNeste(item, linhas)}</dd>
                  </div>
                </dl>
                {item.modoControle === "INDIVIDUAL" ? (
                  <>
                    {doItem.length ? (
                      <ul className="space-y-2">
                        {doItem.map((l) =>
                          l.bem ? (
                            <li key={l.id} className="rounded-md border border-borda p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-medium">{rotuloLinha(l)}</span>
                                <Badge tom={l.condicao === "AVARIADO" ? "perigo" : "neutro"}>
                                  {ROTULO_CONDICAO[l.condicao]}
                                </Badge>
                              </div>
                              <details className="mt-2">
                                <summary className="min-h-11 cursor-pointer content-center text-primaria">
                                  Corrigir unidade
                                </summary>
                                <div className="mt-2 space-y-3">
                                  <FormEditarBem
                                    recebimentoId={id}
                                    linhaId={l.id}
                                    bemId={l.bem.id}
                                    exige={exige}
                                    inicial={{
                                      numeroSerie: l.bem.numeroSerie,
                                      placa: l.bem.placa,
                                      identificacaoFornecedor: l.bem.identificacaoFornecedor,
                                      condicao: l.condicao,
                                      observacao: l.observacao,
                                    }}
                                  />
                                  <AcaoConfirmada
                                    acao={removerLinha}
                                    campos={{ id: l.id, recebimentoId: id }}
                                    rotulo="Remover unidade"
                                    variante="secundaria"
                                    perigoso
                                    titulo={`Remover ${l.bem.codigo} deste recebimento?`}
                                    descricao="O código é cancelado (nunca reaproveitado) e a vistoria em andamento é cancelada."
                                    rotuloConfirmar="Remover"
                                  />
                                </div>
                              </details>
                            </li>
                          ) : null,
                        )}
                      </ul>
                    ) : null}
                    <div className="space-y-3 rounded-md bg-superficie-2 p-3">
                      <h4 className="font-medium">Incluir unidade recebida</h4>
                      <FormNovoBem
                        recebimentoId={id}
                        itemLocacaoId={item.id}
                        exige={exige}
                        descricao={item.descricao}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <FormLote
                      recebimentoId={id}
                      itemLocacaoId={item.id}
                      unidade={item.unidade}
                      descricao={item.descricao}
                      {...(doItem[0]
                        ? {
                            inicial: {
                              quantidade: formatarQuantidade(doItem[0].quantidade),
                              condicao: doItem[0].condicao,
                              observacao: doItem[0].observacao,
                            },
                          }
                        : {})}
                    />
                    {doItem[0] ? (
                      <AcaoConfirmada
                        acao={removerLinha}
                        campos={{ id: doItem[0].id, recebimentoId: id }}
                        rotulo="Não recebi este item"
                        variante="secundaria"
                        titulo={`Retirar ${item.descricao} deste recebimento?`}
                        descricao="A quantidade e a vistoria em andamento deste item são descartadas."
                        rotuloConfirmar="Retirar"
                      />
                    ) : null}
                  </>
                )}
              </section>
            );
          })}
          <Proxima id={id} etapa={etapa} />
        </div>
      );

    case "fotos": {
      const evidencias = await evidenciasDe(
        contexto,
        "ITEM_RECEBIMENTO",
        linhas.map((l) => l.id),
      );
      const podeGerenciar = pode(contexto, "evidencia.substituir_remover");
      return (
        <div className="space-y-4">
          <p className="text-texto-suave">
            Fotografe cada item recebido. Item marcado como <strong>avariado</strong> exige foto. As
            fotos são privadas.
          </p>
          {linhas.length === 0 ? (
            <EmptyState
              icone={ClipboardCheck}
              titulo="Nenhum item incluído"
              descricao="Volte à etapa de itens."
            />
          ) : (
            linhas.map((l) => (
              <section
                key={l.id}
                aria-label={`Fotos de ${rotuloLinha(l)}`}
                className="space-y-3 rounded-md border border-borda bg-superficie p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">{rotuloLinha(l)}</h3>
                  {l.condicao === "AVARIADO" ? (
                    <Badge tom="perigo">Avariado — foto obrigatória</Badge>
                  ) : null}
                </div>
                <GaleriaEvidencias
                  evidencias={evidencias.filter((e) => e.entidadeId === l.id)}
                  fuso={fuso}
                  podeGerenciar={podeGerenciar}
                  caminho={caminho}
                  entidadeTipo="ITEM_RECEBIMENTO"
                />
                <EnviarArquivo
                  entidadeTipo="ITEM_RECEBIMENTO"
                  entidadeId={l.id}
                  tipo="FOTO"
                  rotulo="Tirar foto"
                />
              </section>
            ))
          )}
          <Proxima id={id} etapa={etapa} />
        </div>
      );
    }

    case "checklist": {
      const comChecklist = linhas.filter((l) => itemDe.get(l.itemLocacaoId)?.temChecklist);
      const vistorias = await vistoriasDasLinhas(
        contexto,
        comChecklist.map((l) => l.id),
      );
      const alvo = linhaSelecionada
        ? comChecklist.find((l) => l.id === linhaSelecionada)
        : undefined;
      const vistoriaAlvo = alvo ? vistorias.get(alvo.id) : undefined;
      return (
        <div className="space-y-4">
          {comChecklist.length === 0 ? (
            <Alert tom="info" titulo="Nenhum item deste recebimento exige checklist." />
          ) : (
            <ul className="space-y-2">
              {comChecklist.map((l) => {
                const v = vistorias.get(l.id);
                return (
                  <li
                    key={l.id}
                    className="flex flex-col gap-2 rounded-md border border-borda bg-superficie p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="font-medium">{rotuloLinha(l)}</span>
                    {v ? (
                      <Button asChild variante={l.id === alvo?.id ? "primaria" : "secundaria"}>
                        <Link href={`/recebimentos/${id}?etapa=checklist&linha=${l.id}`}>
                          {l.id === alvo?.id ? "Em edição" : "Abrir vistoria"}
                        </Link>
                      </Button>
                    ) : pode(contexto, "vistoria.registrar") ? (
                      <AcaoSimples
                        acao={iniciarVistoria}
                        campos={{ linhaId: l.id, recebimentoId: id }}
                        rotulo="Fazer vistoria"
                        pendente="Abrindo…"
                      />
                    ) : (
                      <span className="text-texto-suave">Sem permissão para vistoriar</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {alvo && vistoriaAlvo ? (
            <section
              key={vistoriaAlvo.id}
              aria-label={`Vistoria de ${rotuloLinha(alvo)}`}
              className="space-y-3"
            >
              <h3 className="text-lg font-semibold">Vistoria de entrada — {rotuloLinha(alvo)}</h3>
              <PainelVistoria
                contexto={contexto}
                vistoriaId={vistoriaAlvo.id}
                recebimentoId={id}
                caminho={caminho}
              />
            </section>
          ) : null}
          <Proxima id={id} etapa={etapa} />
        </div>
      );
    }

    case "destino": {
      const [locais, responsaveis] = await Promise.all([
        opcoesLocais(contexto),
        opcoesResponsaveis(contexto),
      ]);
      return (
        <FormDestino
          recebimentoId={id}
          locais={locais}
          responsaveis={responsaveis}
          inicial={{
            dataEvento: utcParaHorarioLocal(recebimento.dataEvento ?? new Date(), fuso),
            localId: recebimento.localId,
            responsavelId: recebimento.responsavelId ?? contexto.usuario.id,
            observacoes: recebimento.observacoes,
          }}
        />
      );
    }

    case "revisao": {
      const [pendencias, excesso] = await Promise.all([
        pendenciasRecebimento(id),
        excessoRecebimento(id),
      ]);
      const podeDescartar =
        pode(contexto, "recebimento.cancelar_confirmado") ||
        recebimento.criadoPor === contexto.usuario.id;
      return (
        <div className="space-y-4">
          {pendencias.length ? (
            <Alert tom="alerta" titulo="Ainda falta completar:">
              <ul className="mt-1 list-disc pl-5">
                {pendencias.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </Alert>
          ) : (
            <Alert tom="sucesso" titulo="Tudo pronto para confirmar." />
          )}
          {excesso.length ? (
            <Alert tom="perigo" titulo="Quantidade acima do contratado">
              <p>Ao confirmar, o recebimento ficará aguardando autorização de Compras (RN-25):</p>
              <ul className="mt-1 list-disc pl-5">
                {excesso.map((e) => (
                  <li key={e.descricao}>
                    {e.descricao}: contratado {formatarQuantidade(e.contratada)}, já recebido{" "}
                    {formatarQuantidade(e.jaRecebida)}, agora {formatarQuantidade(e.agora)} —
                    excesso {formatarQuantidade(e.excesso)}
                  </li>
                ))}
              </ul>
            </Alert>
          ) : null}
          <ul className="space-y-1">
            {linhas.map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap justify-between gap-2 border-b border-borda py-2"
              >
                <span>{rotuloLinha(l)}</span>
                <Badge tom={l.condicao === "AVARIADO" ? "perigo" : "neutro"}>
                  {ROTULO_CONDICAO[l.condicao]}
                </Badge>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            {pendencias.length === 0 ? (
              <AcaoConfirmada
                acao={confirmarRecebimento}
                campos={{ id }}
                rotulo={
                  <>
                    <CheckCircle2 aria-hidden /> Confirmar recebimento
                  </>
                }
                titulo={`Confirmar o recebimento ${recebimento.codigo}?`}
                descricao={
                  excesso.length
                    ? "Há quantidade acima do contratado: o recebimento será enviado para autorização de Compras."
                    : "Os bens e lotes passam a constar no local e com o responsável informados. Depois de confirmado, o recebimento não pode ser editado."
                }
                rotuloConfirmar="Confirmar"
              />
            ) : null}
            {podeDescartar ? (
              <AcaoConfirmada
                acao={descartarRecebimento}
                campos={{ id }}
                rotulo="Descartar rascunho"
                variante="secundaria"
                perigoso
                titulo="Descartar este rascunho?"
                descricao="Nada do rascunho é considerado recebido. Fotos já enviadas são preservadas no histórico."
                rotuloConfirmar="Descartar"
                motivo={{ rotulo: "Motivo do descarte" }}
              />
            ) : null}
          </div>
        </div>
      );
    }
  }
}

/** Perguntas da vistoria com respostas atuais e fotos por pergunta. */
async function PainelVistoria({
  contexto,
  vistoriaId,
  recebimentoId,
  caminho,
}: {
  contexto: Contexto;
  vistoriaId: string;
  recebimentoId: string;
  caminho: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: vistoria } = await supabase
    .from("vistorias")
    .select("modelo_id, modelos_checklist(nome, versao)")
    .eq("id", vistoriaId)
    .maybeSingle();
  if (!vistoria) return null;
  const [{ data: perguntas }, { data: respostas }, fotos] = await Promise.all([
    supabase
      .from("perguntas_checklist")
      .select("id, ordem, texto, tipo_resposta, opcoes, obrigatoria, exige_foto_se")
      .eq("modelo_id", vistoria.modelo_id)
      .order("ordem"),
    supabase
      .from("respostas_vistoria")
      .select("pergunta_id, resposta_json")
      .eq("vistoria_id", vistoriaId),
    evidenciasDe(contexto, "VISTORIA", [vistoriaId]),
  ]);
  const lista: PerguntaVistoria[] = (perguntas ?? []).map((p) => ({
    id: p.id,
    ordem: p.ordem,
    texto: p.texto,
    tipoResposta: p.tipo_resposta,
    opcoes: Array.isArray(p.opcoes)
      ? p.opcoes.filter((o): o is string => typeof o === "string")
      : null,
    obrigatoria: p.obrigatoria,
    regraFoto: descreverExigeFoto(p.exige_foto_se as ExigeFoto, p.tipo_resposta),
  }));
  const atuais = Object.fromEntries(
    (respostas ?? []).map((r) => [r.pergunta_id, String(r.resposta_json ?? "")]),
  );
  const podeGerenciar = pode(contexto, "evidencia.substituir_remover");
  const slots = Object.fromEntries(
    lista.map((p) => [
      p.id,
      <div key={p.id} className="space-y-2">
        <GaleriaEvidencias
          evidencias={fotos.filter((f) => f.perguntaId === p.id)}
          fuso={contexto.empresa.timezone}
          podeGerenciar={podeGerenciar}
          caminho={caminho}
          entidadeTipo="VISTORIA"
        />
        <EnviarArquivo
          entidadeTipo="VISTORIA"
          entidadeId={vistoriaId}
          tipo="FOTO"
          perguntaId={p.id}
          rotulo="Foto desta pergunta"
        />
      </div>,
    ]),
  );
  return (
    <>
      <p className="text-sm text-texto-suave">
        Checklist {vistoria.modelos_checklist?.nome} v{vistoria.modelos_checklist?.versao} (versão
        congelada nesta vistoria).
      </p>
      <FormVistoria
        key={vistoriaId}
        vistoriaId={vistoriaId}
        recebimentoId={recebimentoId}
        perguntas={lista}
        respostas={atuais}
        fotos={slots}
      />
    </>
  );
}
