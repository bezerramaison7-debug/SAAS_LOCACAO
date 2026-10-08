import { ListChecks, Pencil, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AcaoConfirmada } from "@/components/forms/acao-confirmada";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  excluirPergunta,
  novaVersaoChecklist,
  publicarChecklist,
} from "@/features/cadastros/checklists/actions";
import { FormModelo } from "@/features/cadastros/checklists/components/form-modelo";
import { FormPergunta } from "@/features/cadastros/checklists/components/form-pergunta";
import { StatusChecklistBadge } from "@/features/cadastros/checklists/components/status-badge";
import {
  listarPerguntas,
  obterModelo,
  versoesDaFamilia,
} from "@/features/cadastros/checklists/queries";
import { descreverExigeFoto, ROTULO_TIPO_RESPOSTA } from "@/features/cadastros/checklists/schemas";
import { exigirPermissaoPagina, pode } from "@/lib/auth/autorizacao";
import { exigirContexto } from "@/lib/auth/contexto";
import { formatarDataHora } from "@/lib/format/datas";
import { uuidSchema } from "@/lib/validation/comum";

export const metadata: Metadata = { title: "Checklist" };

const AVISOS = {
  salvo: "Checklist salvo.",
  pergunta_salva: "Pergunta salva.",
  publicado: "Versão publicada. Ela passa a ser usada nas próximas vistorias.",
  nova_versao: "Nova versão criada em rascunho com as perguntas da versão anterior.",
} as const;

export default async function ChecklistPage({
  params,
  searchParams,
}: PageProps<"/cadastros/checklists/[id]">) {
  const contexto = await exigirContexto();
  exigirPermissaoPagina(contexto, "dados.ler_geral");
  const id = uuidSchema.safeParse((await params).id);
  const modelo = id.success ? await obterModelo(contexto, id.data) : null;
  if (!modelo) notFound();
  const parametros = await searchParams;
  const [perguntas, versoes] = await Promise.all([
    listarPerguntas(contexto, modelo.id),
    versoesDaFamilia(contexto, modelo.familiaId),
  ]);
  const podeGerenciar = pode(contexto, "checklist.gerenciar");
  const editavel = podeGerenciar && modelo.status === "RASCUNHO";
  const temRascunho = versoes.some((v) => v.status === "RASCUNHO");
  const alvo = typeof parametros.pergunta === "string" ? parametros.pergunta : undefined;
  const perguntaEmEdicao = alvo ? perguntas.find((p) => p.id === alvo) : undefined;
  const mostrarFormPergunta = editavel && (alvo === "nova" || perguntaEmEdicao !== undefined);
  const proximaOrdem = Math.min(500, (perguntas.at(-1)?.ordem ?? 0) + 1);
  const aviso = (Object.keys(AVISOS) as (keyof typeof AVISOS)[]).find((k) => parametros[k]);

  let acaoPrimaria;
  if (editavel) {
    acaoPrimaria = (
      <AcaoConfirmada
        acao={publicarChecklist}
        campos={{ id: modelo.id }}
        rotulo="Publicar versão"
        titulo={`Publicar ${modelo.nome} v${modelo.versao}?`}
        descricao="Depois de publicada, a versão não pode ser alterada. A versão vigente anterior será arquivada; vistorias já feitas continuam vinculadas a ela."
        rotuloConfirmar="Publicar"
      />
    );
  } else if (podeGerenciar && !temRascunho) {
    acaoPrimaria = (
      <AcaoConfirmada
        acao={novaVersaoChecklist}
        campos={{ id: modelo.id }}
        rotulo="Criar nova versão"
        titulo="Criar nova versão?"
        descricao={`Será criado um rascunho v${Math.max(...versoes.map((v) => v.versao)) + 1} com as perguntas desta versão.`}
        rotuloConfirmar="Criar rascunho"
      />
    );
  }

  return (
    <>
      <PageHeader
        titulo={`${modelo.nome} — v${modelo.versao}`}
        descricao={modelo.descricao ?? undefined}
        acaoPrimaria={acaoPrimaria}
      />
      {aviso ? <Alert tom="sucesso" titulo={AVISOS[aviso]} className="mb-4" /> : null}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusChecklistBadge status={modelo.status} />
        {modelo.publicadoEm ? (
          <span className="text-texto-suave">
            Publicado em {formatarDataHora(modelo.publicadoEm, contexto.empresa.timezone)}
          </span>
        ) : null}
        {podeGerenciar && !editavel && temRascunho ? (
          <span className="text-texto-suave">
            Já existe uma versão em rascunho desta família (veja abaixo).
          </span>
        ) : null}
      </div>

      {editavel ? (
        <section aria-labelledby="dados-modelo" className="mb-8">
          <h2 id="dados-modelo" className="mb-3 text-xl font-semibold">
            Dados do rascunho
          </h2>
          <FormModelo modelo={modelo} />
        </section>
      ) : null}

      <section aria-labelledby="perguntas" className="mb-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="perguntas" className="text-xl font-semibold">
            Perguntas ({perguntas.length})
          </h2>
          {editavel && !mostrarFormPergunta ? (
            <Button asChild variante="secundaria">
              <Link href={`/cadastros/checklists/${modelo.id}?pergunta=nova`}>
                <Plus aria-hidden /> Adicionar pergunta
              </Link>
            </Button>
          ) : null}
        </div>
        {mostrarFormPergunta ? (
          <FormPergunta
            key={perguntaEmEdicao?.id ?? "nova"}
            modeloId={modelo.id}
            proximaOrdem={proximaOrdem}
            {...(perguntaEmEdicao ? { pergunta: perguntaEmEdicao } : {})}
          />
        ) : null}
        {perguntas.length === 0 ? (
          <EmptyState
            icone={ListChecks}
            titulo="Nenhuma pergunta"
            descricao={
              editavel
                ? "Adicione ao menos uma pergunta para publicar."
                : "Este modelo não tem perguntas."
            }
          />
        ) : (
          <ol className="space-y-3">
            {perguntas.map((p) => (
              <li key={p.id} className="rounded-md border border-borda bg-superficie p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium break-words">
                      {p.ordem}. {p.texto}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Badge tom="info">{ROTULO_TIPO_RESPOSTA[p.tipoResposta]}</Badge>
                      <Badge tom={p.obrigatoria ? "alerta" : "neutro"}>
                        {p.obrigatoria ? "Obrigatória" : "Opcional"}
                      </Badge>
                      <Badge>{descreverExigeFoto(p.exigeFoto, p.tipoResposta)}</Badge>
                    </div>
                    {p.opcoes ? (
                      <p className="text-sm text-texto-suave">Opções: {p.opcoes.join(" · ")}</p>
                    ) : null}
                  </div>
                  {editavel ? (
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variante="secundaria">
                        <Link
                          href={`/cadastros/checklists/${modelo.id}?pergunta=${p.id}`}
                          aria-label={`Editar pergunta ${p.ordem}`}
                        >
                          <Pencil aria-hidden /> Editar
                        </Link>
                      </Button>
                      <AcaoConfirmada
                        acao={excluirPergunta}
                        campos={{ id: p.id, modeloId: modelo.id }}
                        rotulo="Excluir"
                        variante="secundaria"
                        perigoso
                        titulo={`Excluir a pergunta ${p.ordem}?`}
                        descricao={p.texto}
                        rotuloConfirmar="Excluir pergunta"
                      />
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="versoes">
        <h2 id="versoes" className="mb-3 text-xl font-semibold">
          Versões
        </h2>
        <ul className="space-y-2">
          {versoes.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-3">
              {v.id === modelo.id ? (
                <span className="font-medium">v{v.versao} (esta)</span>
              ) : (
                <Link
                  href={`/cadastros/checklists/${v.id}`}
                  className="font-medium text-primaria hover:underline"
                >
                  v{v.versao}
                </Link>
              )}
              <StatusChecklistBadge status={v.status} />
              <span className="text-texto-suave">{v.perguntas} pergunta(s)</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
