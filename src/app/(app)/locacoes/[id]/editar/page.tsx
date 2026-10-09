import { ArrowRight, CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AcaoConfirmada } from "@/components/forms/acao-confirmada";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { opcoesCategorias } from "@/features/cadastros/categorias/queries";
import { opcoesCentrosCusto } from "@/features/cadastros/centros-custo/queries";
import { opcoesFornecedores } from "@/features/cadastros/fornecedores/queries";
import { ativarLocacao } from "@/features/locacoes/actions";
import { EtapasLocacao } from "@/features/locacoes/components/etapas";
import { FormIdentificacao } from "@/features/locacoes/components/form-identificacao";
import { FormItem } from "@/features/locacoes/components/form-item";
import { FormReferencia } from "@/features/locacoes/components/form-referencia";
import { FormVigencia } from "@/features/locacoes/components/form-vigencia";
import { ListaReferencias } from "@/features/locacoes/components/lista-referencias";
import { ResumoLocacao } from "@/features/locacoes/components/resumo";
import { TabelaItens } from "@/features/locacoes/components/tabela-itens";
import {
  listarItens,
  listarReferencias,
  obterLocacao,
  pendenciasAtivacao,
} from "@/features/locacoes/queries";
import { ETAPAS, lerEtapa, ROTULO_ETAPA, type Etapa } from "@/features/locacoes/schemas";
import { exigirPermissaoPagina, pode } from "@/lib/auth/autorizacao";
import { type Contexto, exigirContexto } from "@/lib/auth/contexto";
import { type Locacao } from "@/features/locacoes/queries";
import { uuidSchema } from "@/lib/validation/comum";

export const metadata: Metadata = { title: "Editar locação" };

function Proxima({ locacaoId, etapa }: { locacaoId: string; etapa: Etapa }) {
  const proxima = ETAPAS[ETAPAS.indexOf(etapa) + 1];
  if (!proxima) return null;
  return (
    <Button asChild variante="primaria">
      <Link href={`/locacoes/${locacaoId}/editar?etapa=${proxima}`}>
        Continuar: {ROTULO_ETAPA[proxima]} <ArrowRight aria-hidden />
      </Link>
    </Button>
  );
}

export default async function EditarLocacaoPage({
  params,
  searchParams,
}: PageProps<"/locacoes/[id]/editar">) {
  const contexto = await exigirContexto();
  exigirPermissaoPagina(contexto, "locacao.editar");
  const id = uuidSchema.safeParse((await params).id);
  const locacao = id.success ? await obterLocacao(contexto, id.data) : null;
  if (!locacao) notFound();
  // Fora do rascunho a edição livre acabou (alterações futuras: aditivo com motivo — D-14).
  if (locacao.status !== "RASCUNHO") redirect(`/locacoes/${locacao.id}`);
  const parametros = await searchParams;
  const etapa = lerEtapa(parametros.etapa);

  return (
    <>
      <PageHeader
        titulo={`Locação ${locacao.codigo}`}
        descricao="Rascunho — preencha as etapas e ative quando estiver completa."
        acaoPrimaria={
          <Button asChild variante="secundaria">
            <Link href={`/locacoes/${locacao.id}`}>Ver detalhe</Link>
          </Button>
        }
      />
      <EtapasLocacao atual={etapa} locacaoId={locacao.id} />
      <h2 className="mb-4 text-xl font-semibold">{ROTULO_ETAPA[etapa]}</h2>
      <ConteudoEtapa contexto={contexto} locacao={locacao} etapa={etapa} parametros={parametros} />
    </>
  );
}

async function ConteudoEtapa({
  contexto,
  locacao,
  etapa,
  parametros,
}: {
  contexto: Contexto;
  locacao: Locacao;
  etapa: Etapa;
  parametros: Record<string, string | string[] | undefined>;
}) {
  switch (etapa) {
    case "identificacao": {
      const [fornecedores, centros] = await Promise.all([
        opcoesFornecedores(contexto),
        opcoesCentrosCusto(contexto),
      ]);
      return <FormIdentificacao locacao={locacao} fornecedores={fornecedores} centros={centros} />;
    }
    case "referencias": {
      const referencias = await listarReferencias(contexto, locacao.id);
      const podeGerenciar = pode(contexto, "locacao.referencia.gerenciar");
      return (
        <div className="space-y-6">
          <p className="max-w-3xl text-texto-suave">
            Informe os números exatamente como estão no Sectra. O vínculo é manual: não há
            integração automática. O pedido de compra é obrigatório para ativar; requisição,
            solicitação e contrato são opcionais.
          </p>
          <ListaReferencias
            referencias={referencias}
            locacaoId={locacao.id}
            podeExcluir={podeGerenciar}
          />
          {podeGerenciar ? <FormReferencia locacaoId={locacao.id} retorno="editar" /> : null}
          <Proxima locacaoId={locacao.id} etapa={etapa} />
        </div>
      );
    }
    case "itens": {
      const [itens, categorias] = await Promise.all([
        listarItens(contexto, locacao.id),
        opcoesCategorias(contexto),
      ]);
      const alvo =
        typeof parametros.item === "string"
          ? itens.find((i) => i.id === parametros.item)
          : undefined;
      return (
        <div className="space-y-6">
          {parametros.item_salvo ? <Alert tom="sucesso" titulo="Item salvo." /> : null}
          <TabelaItens itens={itens} locacaoId={locacao.id} editavel mostrarSaldos={false} />
          <FormItem
            key={alvo?.id ?? "novo"}
            locacaoId={locacao.id}
            categorias={categorias}
            {...(alvo ? { item: alvo } : {})}
          />
          <Proxima locacaoId={locacao.id} etapa={etapa} />
        </div>
      );
    }
    case "vigencia":
      return <FormVigencia locacao={locacao} />;
    case "revisao": {
      const [pendencias, referencias, itens] = await Promise.all([
        pendenciasAtivacao(locacao.id),
        listarReferencias(contexto, locacao.id),
        listarItens(contexto, locacao.id),
      ]);
      return (
        <div className="space-y-6">
          {pendencias.length ? (
            <Alert tom="alerta" titulo="Ainda falta completar:">
              <ul className="mt-1 list-disc pl-5">
                {pendencias.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </Alert>
          ) : (
            <Alert tom="sucesso" titulo="Locação completa. Pronta para ativar." />
          )}
          <ResumoLocacao locacao={locacao} fuso={contexto.empresa.timezone} />
          <section aria-labelledby="rev-refs" className="space-y-3">
            <h3 id="rev-refs" className="text-lg font-semibold">
              Documentos vinculados
            </h3>
            <ListaReferencias
              referencias={referencias}
              locacaoId={locacao.id}
              podeExcluir={false}
            />
          </section>
          <section aria-labelledby="rev-itens" className="space-y-3">
            <h3 id="rev-itens" className="text-lg font-semibold">
              Itens contratados
            </h3>
            <TabelaItens
              itens={itens}
              locacaoId={locacao.id}
              editavel={false}
              mostrarSaldos={false}
            />
          </section>
          {pendencias.length === 0 && pode(contexto, "locacao.ativar") ? (
            <AcaoConfirmada
              acao={ativarLocacao}
              campos={{ id: locacao.id }}
              rotulo={
                <>
                  <CheckCircle2 aria-hidden /> Ativar locação
                </>
              }
              titulo={`Ativar a locação ${locacao.codigo}?`}
              descricao="Depois de ativada, a locação libera recebimentos. Fornecedor, itens e vigência não podem mais ser editados livremente."
              rotuloConfirmar="Ativar"
            />
          ) : null}
        </div>
      );
    }
  }
}
