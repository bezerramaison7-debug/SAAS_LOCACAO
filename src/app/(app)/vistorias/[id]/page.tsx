import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AcaoSimples } from "@/components/forms/acao-simples";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { descreverExigeFoto, type ExigeFoto } from "@/features/cadastros/checklists/schemas";
import { concluirVistoria } from "@/features/bens/actions";
import {
  FormVistoria,
  type PerguntaVistoria,
} from "@/features/recebimentos/components/form-vistoria";
import { ROTULO_TIPO_VISTORIA } from "@/features/vistorias/rotulos";
import { EnviarArquivo } from "@/features/evidencias/components/enviar-arquivo";
import { GaleriaEvidencias } from "@/features/evidencias/components/galeria";
import { evidenciasDe } from "@/features/evidencias/queries";
import { pode } from "@/lib/auth/autorizacao";
import { exigirContexto } from "@/lib/auth/contexto";
import { formatarDataHora } from "@/lib/format/datas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/comum";

export const metadata: Metadata = { title: "Vistoria" };

const ROTULO_RESPOSTA: Record<string, string> = {
  SIM: "Sim",
  NAO: "Não",
  CONFORME: "Conforme",
  NAO_CONFORME: "Não conforme",
};

export default async function VistoriaPage({ params, searchParams }: PageProps<"/vistorias/[id]">) {
  const contexto = await exigirContexto();
  const id = uuidSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const supabase = await createSupabaseServerClient();
  const { data: v } = await supabase
    .from("vistorias")
    .select(
      "id, tipo, status, data_evento, concluida_em, modelo_id, bem_id, lote_id, item_recebimento_id, evento_origem_tipo, evento_origem_id, bens(codigo), lotes(codigo), modelos_checklist(nome, versao)",
    )
    .eq("empresa_id", contexto.empresa.id)
    .eq("id", id.data)
    .maybeSingle();
  if (!v) notFound();
  const [{ data: perguntas }, { data: respostas }, fotos] = await Promise.all([
    supabase
      .from("perguntas_checklist")
      .select("id, ordem, texto, tipo_resposta, opcoes, obrigatoria, exige_foto_se")
      .eq("modelo_id", v.modelo_id)
      .order("ordem"),
    supabase
      .from("respostas_vistoria")
      .select("pergunta_id, resposta_json")
      .eq("vistoria_id", v.id),
    evidenciasDe(contexto, "VISTORIA", [v.id]),
  ]);
  const resposta = new Map(
    (respostas ?? []).map((r) => [r.pergunta_id, String(r.resposta_json ?? "")]),
  );
  const fuso = contexto.empresa.timezone;
  const alvo = v.bens?.codigo ?? v.lotes?.codigo;
  // Vistoria de recebimento é editada no fluxo do recebimento; as demais aqui.
  const editavel =
    v.status === "RASCUNHO" && !v.item_recebimento_id && pode(contexto, "vistoria.registrar");
  const pendencias = editavel
    ? ((await supabase.rpc("pendencias_vistoria", { p_vistoria: v.id })).data ?? [])
    : [];
  const podeGerenciarFotos =
    v.status === "RASCUNHO" && pode(contexto, "evidencia.substituir_remover");
  const caminho = `/vistorias/${v.id}`;
  return (
    <>
      <PageHeader
        titulo={`Vistoria ${ROTULO_TIPO_VISTORIA[v.tipo]?.toLowerCase() ?? ""}${alvo ? ` — ${alvo}` : ""}`}
        descricao={`Checklist ${v.modelos_checklist?.nome ?? ""} v${v.modelos_checklist?.versao ?? "?"} · ${formatarDataHora(v.data_evento, fuso)}`}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Badge tom={v.status === "CONCLUIDA" ? "sucesso" : "alerta"}>
          {v.status === "CONCLUIDA"
            ? "Concluída (imutável)"
            : v.status === "CANCELADA"
              ? "Cancelada"
              : "Em andamento"}
        </Badge>
        {v.bem_id ? (
          <Link href={`/bens/${v.bem_id}`} className="text-primaria hover:underline">
            Ver bem
          </Link>
        ) : v.lote_id ? (
          <Link href={`/bens/lotes/${v.lote_id}`} className="text-primaria hover:underline">
            Ver lote
          </Link>
        ) : null}
        {v.evento_origem_tipo === "DEVOLUCAO" && v.evento_origem_id ? (
          <Link
            href={`/devolucoes/${v.evento_origem_id}`}
            className="text-primaria hover:underline"
          >
            Ver devolução
          </Link>
        ) : null}
        {v.evento_origem_tipo === "RECEBIMENTO" && v.evento_origem_id ? (
          <Link
            href={`/recebimentos/${v.evento_origem_id}`}
            className="text-primaria hover:underline"
          >
            Ver recebimento
          </Link>
        ) : null}
      </div>
      {(await searchParams).concluida ? (
        <Alert
          tom="sucesso"
          titulo="Vistoria concluída. A partir de agora ela é imutável."
          className="mb-4"
        />
      ) : null}
      {editavel ? (
        <EdicaoVistoria
          vistoriaId={v.id}
          perguntas={(perguntas ?? []).map((p) => ({
            id: p.id,
            ordem: p.ordem,
            texto: p.texto,
            tipoResposta: p.tipo_resposta,
            opcoes: Array.isArray(p.opcoes)
              ? p.opcoes.filter((o): o is string => typeof o === "string")
              : null,
            obrigatoria: p.obrigatoria,
            regraFoto: descreverExigeFoto(p.exige_foto_se as ExigeFoto, p.tipo_resposta),
          }))}
          respostas={Object.fromEntries(resposta)}
          fotos={fotos}
          fuso={fuso}
          podeGerenciar={podeGerenciarFotos}
          caminho={caminho}
          pendencias={pendencias}
        />
      ) : (
        <ol className="space-y-3">
          {(perguntas ?? []).map((p) => {
            const r = resposta.get(p.id);
            return (
              <li key={p.id} className="space-y-2 rounded-md border border-borda bg-superficie p-3">
                <p className="font-medium">
                  {p.ordem}. {p.texto}
                </p>
                <p>
                  <span className="text-texto-suave">Resposta: </span>
                  {r ? (
                    (ROTULO_RESPOSTA[r] ?? r)
                  ) : (
                    <span className="text-texto-suave">sem resposta</span>
                  )}
                </p>
                <p className="text-sm text-texto-suave">
                  {descreverExigeFoto(p.exige_foto_se as ExigeFoto, p.tipo_resposta)}
                </p>
                <GaleriaEvidencias
                  evidencias={fotos.filter((f) => f.perguntaId === p.id)}
                  fuso={fuso}
                  podeGerenciar={podeGerenciarFotos}
                  caminho={caminho}
                  entidadeTipo="VISTORIA"
                />
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}

function EdicaoVistoria({
  vistoriaId,
  perguntas,
  respostas,
  fotos,
  fuso,
  podeGerenciar,
  caminho,
  pendencias,
}: {
  vistoriaId: string;
  perguntas: PerguntaVistoria[];
  respostas: Record<string, string>;
  fotos: Awaited<ReturnType<typeof evidenciasDe>>;
  fuso: string;
  podeGerenciar: boolean;
  caminho: string;
  pendencias: string[];
}) {
  const slots = Object.fromEntries(
    perguntas.map((p) => [
      p.id,
      <div key={p.id} className="space-y-2">
        <GaleriaEvidencias
          evidencias={fotos.filter((f) => f.perguntaId === p.id)}
          fuso={fuso}
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
    <div className="space-y-6">
      <FormVistoria
        key={vistoriaId}
        vistoriaId={vistoriaId}
        perguntas={perguntas}
        respostas={respostas}
        fotos={slots}
      />
      <section aria-labelledby="concluir-vistoria" className="space-y-3 border-t border-borda pt-4">
        <h2 id="concluir-vistoria" className="text-lg font-semibold">
          Concluir vistoria
        </h2>
        {pendencias.length ? (
          <Alert tom="alerta" titulo="Pendências para concluir">
            <ul className="list-disc pl-5">
              {pendencias.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </Alert>
        ) : (
          <p className="text-sm text-texto-suave">
            Tudo respondido. Após concluir, respostas e fotos não podem mais ser alteradas.
          </p>
        )}
        <AcaoSimples
          acao={concluirVistoria}
          campos={{ id: vistoriaId }}
          rotulo="Concluir vistoria"
          pendente="Concluindo…"
          variante="primaria"
        />
      </section>
    </div>
  );
}
