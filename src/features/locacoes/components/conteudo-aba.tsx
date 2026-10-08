import {
  ArrowLeftRight,
  FileText,
  History,
  Package,
  PackageCheck,
  Receipt,
  Undo2,
} from "lucide-react";

import Link from "next/link";

import { DataTable } from "@/components/tables/data-table";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { EnviarArquivo } from "@/features/evidencias/components/enviar-arquivo";
import { pode } from "@/lib/auth/autorizacao";
import { type Contexto } from "@/lib/auth/contexto";
import { formatarDataCivil, formatarDataHora } from "@/lib/format/datas";
import { formatarMoeda, formatarQuantidade } from "@/lib/format/moeda";

import {
  bensELotesDaLocacao,
  cobrancasDaLocacao,
  devolucoesDaLocacao,
  evidenciasDaLocacao,
  historicoDaLocacao,
  movimentacoesDaLocacao,
  recebimentosDaLocacao,
} from "../abas";
import {
  listarItens,
  listarReferencias,
  pendenciasAtivacao,
  saldoLocacao,
  type Locacao,
} from "../queries";
import {
  ROTULO_STATUS_BEM,
  ROTULO_STATUS_COBRANCA,
  ROTULO_STATUS_DEVOLUCAO,
  ROTULO_STATUS_EVIDENCIA,
  ROTULO_STATUS_LOTE,
  ROTULO_STATUS_MOVIMENTACAO,
  ROTULO_STATUS_RECEBIMENTO,
  ROTULO_TIPO_EVIDENCIA,
  rotulo,
  rotuloAcaoAuditoria,
} from "../rotulos-eventos";
import { type Aba } from "../schemas";
import { FormReferencia } from "./form-referencia";
import { ListaReferencias } from "./lista-referencias";
import { ResumoLocacao } from "./resumo";
import { TabelaItens } from "./tabela-itens";

type Props = { contexto: Contexto; locacao: Locacao; aba: Aba };

const STATUS_COM_REFERENCIA = ["RASCUNHO", "ATIVA", "EM_DEVOLUCAO"];

export async function ConteudoAba({ contexto, locacao, aba }: Props) {
  const fuso = contexto.empresa.timezone;
  const dataHora = (v: string | null) => (v ? formatarDataHora(v, fuso) : "—");

  switch (aba) {
    case "resumo": {
      const verValores = pode(contexto, "valores.ver");
      const [referencias, pendencias, saldo] = await Promise.all([
        pode(contexto, "dados.ler_geral")
          ? listarReferencias(contexto, locacao.id)
          : Promise.resolve(null),
        locacao.status === "RASCUNHO" ? pendenciasAtivacao(locacao.id) : Promise.resolve([]),
        verValores && locacao.status !== "RASCUNHO"
          ? saldoLocacao(contexto, locacao.id)
          : Promise.resolve(null),
      ]);
      const podeVincular =
        STATUS_COM_REFERENCIA.includes(locacao.status) &&
        pode(contexto, "locacao.referencia.gerenciar");
      return (
        <div className="space-y-6">
          {pendencias.length ? (
            <Alert tom="alerta" titulo="Pendências para ativar:">
              <ul className="mt-1 list-disc pl-5">
                {pendencias.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </Alert>
          ) : null}
          {saldo ? (
            <dl className="grid gap-3 sm:grid-cols-3">
              {[
                ["Bens individuais em posse", saldo.bensAtivos],
                ["Saldo em lotes", saldo.saldoLotes],
                ["A receber do contratado", saldo.aReceber],
              ].map(([termo, valor]) => (
                <div key={termo} className="rounded-md border border-borda bg-superficie p-3">
                  <dt className="text-sm text-texto-suave">{termo}</dt>
                  <dd className="text-2xl font-semibold">{formatarQuantidade(valor ?? "0")}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          <ResumoLocacao locacao={locacao} fuso={fuso} />
          {referencias ? (
            <section aria-labelledby="refs" className="space-y-3">
              <h2 id="refs" className="text-xl font-semibold">
                Documentos do Sectra
              </h2>
              <ListaReferencias
                referencias={referencias}
                locacaoId={locacao.id}
                podeExcluir={
                  locacao.status === "RASCUNHO" && pode(contexto, "locacao.referencia.gerenciar")
                }
              />
              {podeVincular ? <FormReferencia locacaoId={locacao.id} retorno="detalhe" /> : null}
            </section>
          ) : (
            <p className="text-texto-suave">
              Seu perfil vê apenas os bens sob sua responsabilidade nesta locação.
            </p>
          )}
        </div>
      );
    }

    case "itens": {
      const itens = await listarItens(contexto, locacao.id);
      return (
        <TabelaItens
          itens={itens}
          locacaoId={locacao.id}
          editavel={false}
          mostrarSaldos={locacao.status !== "RASCUNHO"}
        />
      );
    }

    case "recebimentos": {
      const linhas = await recebimentosDaLocacao(contexto, locacao.id);
      return (
        <DataTable
          legenda="Recebimentos"
          linhas={linhas}
          chaveLinha={(r) => r.id}
          vazio={
            <EmptyState
              icone={PackageCheck}
              titulo="Nenhum recebimento"
              descricao="Os recebimentos são registrados pela Operação após a ativação."
            />
          }
          colunas={[
            {
              chave: "codigo",
              titulo: "Recebimento",
              principal: true,
              render: (r) => (
                <Link
                  href={`/recebimentos/${r.id}`}
                  className="font-mono font-medium text-primaria hover:underline"
                >
                  {r.codigo}
                </Link>
              ),
            },
            {
              chave: "status",
              titulo: "Situação",
              render: (r) => <Badge>{rotulo(ROTULO_STATUS_RECEBIMENTO, r.status)}</Badge>,
            },
            { chave: "data", titulo: "Data do recebimento", render: (r) => dataHora(r.dataEvento) },
            { chave: "local", titulo: "Local", render: (r) => r.local ?? "—" },
            {
              chave: "confirmado",
              titulo: "Confirmado em",
              render: (r) => dataHora(r.confirmadoEm),
            },
          ]}
        />
      );
    }

    case "bens": {
      const { bens, lotes } = await bensELotesDaLocacao(contexto, locacao.id);
      return (
        <div className="space-y-6">
          <DataTable
            legenda="Bens individuais"
            linhas={bens}
            chaveLinha={(b) => b.id}
            vazio={
              <EmptyState
                icone={Package}
                titulo="Nenhum bem individual"
                descricao="Os bens são criados na confirmação do recebimento."
              />
            }
            colunas={[
              {
                chave: "codigo",
                titulo: "Bem",
                principal: true,
                render: (b) => (
                  <Link
                    href={`/bens/${b.id}`}
                    className="font-mono font-medium text-primaria hover:underline"
                  >
                    {b.codigo}
                  </Link>
                ),
              },
              { chave: "item", titulo: "Item", render: (b) => b.item },
              { chave: "ident", titulo: "Série/placa", render: (b) => b.identificacao ?? "—" },
              {
                chave: "status",
                titulo: "Situação",
                render: (b) => <Badge>{rotulo(ROTULO_STATUS_BEM, b.status)}</Badge>,
              },
              { chave: "local", titulo: "Local atual", render: (b) => b.local ?? "—" },
            ]}
          />
          <DataTable
            legenda="Lotes"
            linhas={lotes}
            chaveLinha={(l) => l.id}
            vazio={
              <EmptyState
                icone={Package}
                titulo="Nenhum lote"
                descricao="Os lotes são criados na confirmação do recebimento."
              />
            }
            colunas={[
              {
                chave: "codigo",
                titulo: "Lote",
                principal: true,
                render: (l) => (
                  <Link
                    href={`/bens/lotes/${l.id}`}
                    className="font-mono font-medium text-primaria hover:underline"
                  >
                    {l.codigo}
                  </Link>
                ),
              },
              { chave: "item", titulo: "Item", render: (l) => l.item },
              {
                chave: "saldo",
                titulo: "Saldo",
                render: (l) => `${formatarQuantidade(l.saldo)} ${l.unidade}`,
              },
              {
                chave: "status",
                titulo: "Situação",
                render: (l) => <Badge>{rotulo(ROTULO_STATUS_LOTE, l.status)}</Badge>,
              },
              { chave: "local", titulo: "Local atual", render: (l) => l.local ?? "—" },
            ]}
          />
        </div>
      );
    }

    case "movimentacoes": {
      const { bens, lotes } = await bensELotesDaLocacao(contexto, locacao.id);
      const linhas = await movimentacoesDaLocacao(
        contexto,
        bens.map((b) => b.id),
        lotes.map((l) => l.id),
      );
      return (
        <DataTable
          legenda="Movimentações"
          linhas={linhas}
          chaveLinha={(m) => m.id}
          vazio={
            <EmptyState
              icone={ArrowLeftRight}
              titulo="Nenhuma movimentação"
              descricao="Transferências entre locais aparecem aqui."
            />
          }
          colunas={[
            {
              chave: "codigo",
              titulo: "Movimentação",
              principal: true,
              render: (m) => <span className="font-mono font-medium">{m.codigo}</span>,
            },
            { chave: "alvo", titulo: "Bem/lote", render: (m) => m.alvo },
            {
              chave: "trajeto",
              titulo: "Origem → destino",
              render: (m) => `${m.origem} → ${m.destino}`,
            },
            { chave: "data", titulo: "Data", render: (m) => dataHora(m.dataEvento) },
            {
              chave: "status",
              titulo: "Situação",
              render: (m) => <Badge>{rotulo(ROTULO_STATUS_MOVIMENTACAO, m.status)}</Badge>,
            },
          ]}
        />
      );
    }

    case "evidencias": {
      const linhas = await evidenciasDaLocacao(contexto, locacao.id);
      const podeEnviar = pode(contexto, "evidencia.enviar");
      return (
        <div className="space-y-4">
          {podeEnviar ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              <EnviarArquivo
                entidadeTipo="LOCACAO"
                entidadeId={locacao.id}
                tipo="CONTRATO"
                rotulo="Anexar contrato"
              />
              <EnviarArquivo
                entidadeTipo="LOCACAO"
                entidadeId={locacao.id}
                tipo="DOCUMENTO"
                rotulo="Anexar outro documento"
              />
            </div>
          ) : null}
          <DataTable
            legenda="Documentos da locação"
            linhas={linhas}
            chaveLinha={(e) => e.id}
            vazio={
              <EmptyState
                icone={FileText}
                titulo="Nenhum documento anexado"
                descricao="Contrato, pedido assinado e aditivos (PDF ou imagem, privados)."
              />
            }
            colunas={[
              {
                chave: "nome",
                titulo: "Arquivo",
                principal: true,
                render: (e) =>
                  e.status === "ATIVA" ? (
                    <a
                      href={`/api/files/${e.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium break-all text-primaria hover:underline"
                    >
                      {e.nome}
                    </a>
                  ) : (
                    <span className="font-medium break-all">{e.nome}</span>
                  ),
              },
              {
                chave: "tipo",
                titulo: "Tipo",
                render: (e) => rotulo(ROTULO_TIPO_EVIDENCIA, e.tipo),
              },
              { chave: "enviada", titulo: "Enviado em", render: (e) => dataHora(e.enviadaEm) },
              {
                chave: "status",
                titulo: "Situação",
                render: (e) => <Badge>{rotulo(ROTULO_STATUS_EVIDENCIA, e.status)}</Badge>,
              },
            ]}
          />
        </div>
      );
    }

    case "devolucoes": {
      const linhas = await devolucoesDaLocacao(contexto, locacao.id);
      return (
        <DataTable
          legenda="Devoluções"
          linhas={linhas}
          chaveLinha={(d) => d.id}
          vazio={
            <EmptyState
              icone={Undo2}
              titulo="Nenhuma devolução"
              descricao="Devoluções parciais ou totais ao fornecedor aparecem aqui."
            />
          }
          colunas={[
            {
              chave: "codigo",
              titulo: "Devolução",
              principal: true,
              render: (d) => <span className="font-mono font-medium">{d.codigo}</span>,
            },
            {
              chave: "status",
              titulo: "Situação",
              render: (d) => <Badge>{rotulo(ROTULO_STATUS_DEVOLUCAO, d.status)}</Badge>,
            },
            {
              chave: "solicitada",
              titulo: "Solicitada em",
              render: (d) => dataHora(d.solicitadaEm),
            },
            { chave: "agendada", titulo: "Agendada para", render: (d) => dataHora(d.agendadaPara) },
            { chave: "retirada", titulo: "Retirada em", render: (d) => dataHora(d.retiradaEm) },
          ]}
        />
      );
    }

    case "cobrancas": {
      const linhas = await cobrancasDaLocacao(contexto, locacao.id);
      return (
        <DataTable
          legenda="Cobranças"
          linhas={linhas}
          chaveLinha={(c) => c.id}
          vazio={
            <EmptyState
              icone={Receipt}
              titulo="Nenhuma cobrança"
              descricao="Cobranças do fornecedor são lançadas pelo Financeiro."
            />
          }
          colunas={[
            {
              chave: "codigo",
              titulo: "Cobrança",
              principal: true,
              render: (c) => <span className="font-mono font-medium">{c.codigo}</span>,
            },
            {
              chave: "competencia",
              titulo: "Competência",
              render: (c) =>
                `${formatarDataCivil(c.competenciaInicio)} a ${formatarDataCivil(c.competenciaFim)}`,
            },
            { chave: "valor", titulo: "Valor cobrado", render: (c) => formatarMoeda(c.valor) },
            { chave: "documento", titulo: "Documento", render: (c) => c.documento ?? "—" },
            {
              chave: "status",
              titulo: "Situação",
              render: (c) => <Badge>{rotulo(ROTULO_STATUS_COBRANCA, c.status)}</Badge>,
            },
          ]}
        />
      );
    }

    case "historico": {
      const linhas = await historicoDaLocacao(contexto, locacao.id);
      return (
        <DataTable
          legenda="Histórico (auditoria)"
          linhas={linhas}
          chaveLinha={(h) => String(h.id)}
          vazio={
            <EmptyState
              icone={History}
              titulo="Sem registros"
              descricao="As alterações desta locação aparecem aqui."
            />
          }
          colunas={[
            {
              chave: "acao",
              titulo: "Evento",
              principal: true,
              render: (h) => <span className="font-medium">{rotuloAcaoAuditoria(h.acao)}</span>,
            },
            { chave: "ator", titulo: "Por", render: (h) => h.ator },
            { chave: "em", titulo: "Quando", render: (h) => dataHora(h.em) },
            { chave: "motivo", titulo: "Motivo", render: (h) => h.motivo ?? "—" },
          ]}
        />
      );
    }
  }
}
