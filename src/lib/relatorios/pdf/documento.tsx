import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { type ComponentProps, type ReactNode } from "react";

import {
  ROTULO_STATUS_BEM,
  ROTULO_STATUS_COBRANCA,
  ROTULO_STATUS_DEVOLUCAO,
  ROTULO_STATUS_LOTE,
  ROTULO_STATUS_MOVIMENTACAO,
  rotulo,
} from "@/features/locacoes/rotulos-eventos";
import { ROTULO_PERIODICIDADE, type Periodicidade } from "@/features/locacoes/rotulos";
import {
  ROTULO_PRIORIDADE,
  ROTULO_RESULTADO,
  ROTULO_STATUS_OCORRENCIA,
  ROTULO_TIPO_OCORRENCIA,
} from "@/features/ocorrencias/rotulos";
import { ROTULO_CONDICAO } from "@/features/recebimentos/rotulos";
import { ROTULO_TIPO_VISTORIA } from "@/features/vistorias/rotulos";
import { formatarDataCivil, formatarDataHora } from "@/lib/format/datas";
import { formatarMoeda, formatarQuantidade } from "@/lib/format/moeda";

import { type EvidenciaSnapshot, type Snapshot, textoPdf } from "../snapshot";

export const VERSAO_TEMPLATE = "relatorio-1.0";

// Sem hifenização: códigos, números de série e hashes nunca recebem "-" extra.
Font.registerHyphenationCallback((palavra) => [palavra]);

/** Hash em grupos de 8 (quebra de linha só nos espaços; para conferir, remova os espaços). */
export function hashLegivel(hash: string): string {
  return hash.match(/.{1,8}/g)?.join(" ") ?? hash;
}

/** Foto já normalizada (JPEG) pronta para o PDF; `null` quando não pôde ser lida. */
export type FotoPdf = { evidencia: EvidenciaSnapshot; jpeg: Buffer | null };

const ROTULO_STATUS_LOCACAO: Record<string, string> = {
  RASCUNHO: "Rascunho",
  ATIVA: "Ativa",
  EM_DEVOLUCAO: "Em devolução",
  ENCERRADA_OPERACIONALMENTE: "Encerrada (operacional)",
  CANCELADA: "Cancelada",
};
const ROTULO_FINANCEIRO: Record<string, string> = {
  NAO_INICIADO: "Não iniciado",
  EM_COBRANCA: "Em cobrança",
  ENCERRAMENTO_PENDENTE: "Encerramento pendente",
  ENCERRADO: "Encerrado",
};
const TITULO_TIPO: Record<Snapshot["relatorio"]["tipo"], string> = {
  LOCACAO: "Relatório da locação",
  BEM: "Relatório do bem",
  LOCAL: "Relatório do local",
  PERIODO: "Relatório do período",
};

const s = StyleSheet.create({
  pagina: {
    paddingTop: 36,
    paddingBottom: 54,
    paddingHorizontal: 36,
    fontSize: 9,
    fontFamily: "Helvetica",
  },
  titulo: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  subtitulo: { fontSize: 10, color: "#444", marginBottom: 2 },
  secao: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginTop: 14,
    marginBottom: 6,
    color: "#1d3a6b",
  },
  subsecao: { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 8, marginBottom: 3 },
  linha: { flexDirection: "row" },
  campo: { width: "50%", marginBottom: 4, paddingRight: 6 },
  rotulo: { color: "#555", fontSize: 8 },
  valor: { fontSize: 9 },
  tabela: { borderWidth: 0.5, borderColor: "#999", marginBottom: 6 },
  cabecalhoTabela: {
    flexDirection: "row",
    backgroundColor: "#e8edf5",
    fontFamily: "Helvetica-Bold",
  },
  linhaTabela: { flexDirection: "row", borderTopWidth: 0.5, borderColor: "#bbb" },
  celula: { padding: 3, fontSize: 8 },
  vazio: { color: "#666", fontStyle: "italic", marginBottom: 4 },
  fotos: { flexDirection: "row", flexWrap: "wrap" },
  foto: { width: "50%", padding: 4 },
  imagem: { objectFit: "contain", maxHeight: 220 },
  legenda: { fontSize: 7.5, color: "#222", marginTop: 2 },
  rodape: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    fontSize: 7,
    color: "#555",
    borderTopWidth: 0.5,
    borderColor: "#999",
    paddingTop: 4,
  },
});

type Contexto = { fuso: string };

const dataHora = (v: string | null, c: Contexto) => (v ? formatarDataHora(v, c.fuso) : "—");
const dataCivil = (v: string | null) => (v ? formatarDataCivil(v) : "—");
const qtd = (v: string | null) => (v === null ? "—" : formatarQuantidade(v));

type Estilo = NonNullable<ComponentProps<typeof View>["style"]>;

function T({ children, style }: { children: ReactNode; style?: Estilo }) {
  const conteudo = typeof children === "string" ? textoPdf(children) : children;
  return style ? <Text style={style}>{conteudo}</Text> : <Text>{conteudo}</Text>;
}

function Campos({ itens }: { itens: [string, string | null | undefined][] }) {
  return (
    <View style={[s.linha, { flexWrap: "wrap" }]}>
      {itens.map(([r, v]) => (
        <View key={r} style={s.campo} wrap={false}>
          <T style={s.rotulo}>{r}</T>
          <T style={s.valor}>{v || "—"}</T>
        </View>
      ))}
    </View>
  );
}

function Tabela({
  colunas,
  linhas,
  vazio,
}: {
  colunas: { titulo: string; largura: string }[];
  linhas: (string | null)[][];
  vazio: string;
}) {
  if (!linhas.length) return <T style={s.vazio}>{vazio}</T>;
  return (
    <View style={s.tabela}>
      <View style={s.cabecalhoTabela} fixed>
        {colunas.map((c) => (
          <T key={c.titulo} style={[s.celula, { width: c.largura }]}>
            {c.titulo}
          </T>
        ))}
      </View>
      {linhas.map((l, i) => (
        <View key={i} style={s.linhaTabela} wrap={false}>
          {l.map((v, j) => (
            <T key={j} style={[s.celula, { width: colunas[j]?.largura ?? "10%" }]}>
              {v ?? "—"}
            </T>
          ))}
        </View>
      ))}
    </View>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <View>
      <T style={s.secao}>{titulo}</T>
      {children}
    </View>
  );
}

function legendaFoto(e: EvidenciaSnapshot, c: Contexto): string {
  const partes = [
    e.legenda.evento,
    e.legenda.item ? `Item ${e.legenda.item}` : null,
    dataHora(e.data, c),
    e.legenda.local ? `Local: ${e.legenda.local}` : null,
    e.legenda.usuario ? `Por: ${e.legenda.usuario}` : null,
  ].filter(Boolean);
  return partes.join(" · ") + (e.legenda.texto ? ` — ${e.legenda.texto}` : "");
}

export function DocumentoRelatorio({
  snapshot,
  hashDados,
  geradoEm,
  fotos,
}: {
  snapshot: Snapshot;
  hashDados: string;
  geradoEm: string;
  fotos: FotoPdf[];
}) {
  const c: Contexto = { fuso: snapshot.empresa.timezone };
  const r = snapshot.relatorio;
  const l = snapshot.locacao;
  const alvo =
    r.tipo === "PERIODO"
      ? `${dataCivil(snapshot.alvo?.inicio ?? null)} a ${dataCivil(snapshot.alvo?.fim ?? null)}`
      : r.tipo === "LOCAL"
        ? `${snapshot.alvo?.nome ?? ""} (${snapshot.alvo?.codigo ?? ""})`
        : (snapshot.alvo?.codigo ?? "");
  const imagens = fotos.filter((f) => f.evidencia.mime.startsWith("image/"));
  const documentos = snapshot.evidencias.filter((e) => !e.mime.startsWith("image/"));

  return (
    <Document
      title={textoPdf(`${TITULO_TIPO[r.tipo]} ${alvo} — ${r.codigo}`)}
      author={textoPdf(snapshot.empresa.nome)}
      creator={`Rastreio de Locações · ${VERSAO_TEMPLATE}`}
      producer="Rastreio de Locações"
    >
      <Page size="A4" style={s.pagina} wrap>
        <T style={s.titulo}>{`${TITULO_TIPO[r.tipo]} ${alvo}`}</T>
        <T style={s.subtitulo}>{snapshot.empresa.nome}</T>
        <Campos
          itens={[
            ["Relatório", r.codigo],
            ["Gerado em", dataHora(geradoEm, c)],
            ["Gerado por", r.solicitado_por],
            ["Versão do template", r.versao_template],
            ["Hash SHA-256 dos dados", hashLegivel(hashDados)],
            ["Solicitado em", dataHora(r.solicitado_em, c)],
          ]}
        />

        {l ? (
          <>
            <Secao titulo="Identificação e estado">
              <Campos
                itens={[
                  ["Locação", l.codigo],
                  ["Estado operacional", rotulo(ROTULO_STATUS_LOCACAO, l.status)],
                  ["Estado financeiro", rotulo(ROTULO_FINANCEIRO, l.status_financeiro)],
                  ["Encerramento financeiro (data)", dataCivil(l.data_encerramento_financeiro)],
                  ["Encerramento operacional", dataHora(l.encerrada_operacional_em, c)],
                  ["Desmobilização iniciada", dataHora(l.desmobilizacao_iniciada_em, c)],
                  ["Observações", l.observacoes],
                ]}
              />
            </Secao>
            <Secao titulo="Referências Sectra e externas">
              <Tabela
                colunas={[
                  { titulo: "Sistema", largura: "20%" },
                  { titulo: "Tipo", largura: "25%" },
                  { titulo: "Número", largura: "35%" },
                  { titulo: "Data", largura: "20%" },
                ]}
                linhas={l.referencias.map((x) => [
                  x.sistema,
                  x.tipo,
                  x.numero,
                  dataCivil(x.data_documento),
                ])}
                vazio="Nenhuma referência registrada."
              />
            </Secao>
            <Secao titulo="Fornecedor, centro de custo e vigência">
              <Campos
                itens={[
                  [
                    "Fornecedor",
                    l.fornecedor ? (l.fornecedor.nome_fantasia ?? l.fornecedor.razao_social) : null,
                  ],
                  ["Razão social", l.fornecedor?.razao_social],
                  ["Documento", l.fornecedor?.documento],
                  ["Centro de custo", l.centro_custo],
                  ["Início previsto", dataCivil(l.inicio_previsto)],
                  ["Término previsto", dataCivil(l.termino_previsto)],
                  ["Início efetivo", dataCivil(l.inicio_efetivo)],
                  ["Ativada em", dataHora(l.ativada_em, c)],
                ]}
              />
            </Secao>
            <Secao titulo="Itens contratados, recebidos, devolvidos e saldo">
              <Tabela
                colunas={[
                  { titulo: "Item", largura: snapshot.incluir_valores ? "28%" : "36%" },
                  { titulo: "Controle", largura: "10%" },
                  { titulo: "Contratado", largura: "11%" },
                  { titulo: "Recebido", largura: "11%" },
                  { titulo: "Devolvido", largura: "11%" },
                  { titulo: "Saldo", largura: "9%" },
                  { titulo: "Periodicidade", largura: "12%" },
                  ...(snapshot.incluir_valores ? [{ titulo: "Valor unit.", largura: "8%" }] : []),
                ]}
                linhas={l.itens.map((i) => [
                  `${i.descricao} (${i.unidade})`,
                  i.modo === "LOTE" ? "Lote" : "Individual",
                  qtd(i.contratada),
                  qtd(i.recebida),
                  qtd(i.devolvida),
                  qtd(i.saldo),
                  ROTULO_PERIODICIDADE[i.periodicidade as Periodicidade] ?? i.periodicidade,
                  ...(snapshot.incluir_valores
                    ? [i.valor_unitario ? formatarMoeda(i.valor_unitario) : "—"]
                    : []),
                ])}
                vazio="Nenhum item contratado."
              />
            </Secao>
          </>
        ) : null}

        {r.tipo !== "PERIODO" ? (
          <Secao titulo="Fichas dos bens e lotes">
            <Tabela
              colunas={[
                { titulo: "Bem", largura: "12%" },
                { titulo: "Item", largura: "22%" },
                { titulo: "Série/placa/patrimônio", largura: "20%" },
                { titulo: "Situação", largura: "12%" },
                { titulo: "Local", largura: "18%" },
                { titulo: "Responsável", largura: "16%" },
              ]}
              linhas={snapshot.bens.map((b) => [
                b.codigo + (b.substitui ? ` (substitui ${b.substitui})` : ""),
                b.item,
                [b.numero_serie, b.placa, b.identificacao_fornecedor].filter(Boolean).join(" / ") ||
                  "—",
                rotulo(ROTULO_STATUS_BEM, b.status),
                b.local,
                b.responsavel,
              ])}
              vazio="Nenhum bem individual."
            />
            {snapshot.lotes.length ? (
              <Tabela
                colunas={[
                  { titulo: "Lote", largura: "12%" },
                  { titulo: "Item", largura: "22%" },
                  { titulo: "Recebido", largura: "9%" },
                  { titulo: "Devolvido", largura: "9%" },
                  { titulo: "Dividido", largura: "8%" },
                  { titulo: "Baixado", largura: "8%" },
                  { titulo: "Saldo", largura: "8%" },
                  { titulo: "Local", largura: "12%" },
                  { titulo: "Responsável", largura: "12%" },
                ]}
                linhas={snapshot.lotes.map((x) => [
                  x.codigo + (x.origem ? ` (de ${x.origem})` : ""),
                  `${x.item} (${x.unidade}) · ${rotulo(ROTULO_STATUS_LOTE, x.status)}`,
                  qtd(x.recebida),
                  qtd(x.devolvida),
                  qtd(x.dividida),
                  qtd(x.baixada),
                  qtd(x.saldo),
                  x.local,
                  x.responsavel,
                ])}
                vazio=""
              />
            ) : null}
          </Secao>
        ) : null}

        <Secao titulo="Recebimentos">
          {snapshot.recebimentos.length ? (
            snapshot.recebimentos.map((rc) => (
              <View key={rc.codigo} wrap={false}>
                <T style={s.subsecao}>
                  {`${rc.codigo} · ${dataHora(rc.data_evento, c)} · ${rc.local ?? "—"} · responsável ${rc.responsavel ?? "—"} · registrado por ${rc.recebido_por ?? "—"}`}
                </T>
                <Tabela
                  colunas={[
                    { titulo: "Item", largura: "45%" },
                    { titulo: "Bem/lote", largura: "20%" },
                    { titulo: "Quantidade", largura: "15%" },
                    { titulo: "Condição", largura: "20%" },
                  ]}
                  linhas={rc.linhas.map((x) => [
                    x.item,
                    x.alvo,
                    qtd(x.quantidade),
                    rotulo(ROTULO_CONDICAO, x.condicao),
                  ])}
                  vazio="Sem itens."
                />
              </View>
            ))
          ) : (
            <T style={s.vazio}>Nenhum recebimento no escopo.</T>
          )}
        </Secao>

        <Secao titulo="Checklists e vistorias">
          {snapshot.vistorias.length ? (
            snapshot.vistorias.map((v, i) => (
              <View key={i} wrap={false}>
                <T style={s.subsecao}>
                  {`${rotulo(ROTULO_TIPO_VISTORIA, v.tipo)} · ${v.alvo ?? "—"} · ${dataHora(v.data_evento, c)} · ${v.status === "CONCLUIDA" ? "concluída" : "em andamento"} · checklist ${v.modelo} v${v.versao} · por ${v.realizada_por ?? "—"}`}
                </T>
                <Tabela
                  colunas={[
                    { titulo: "Nº", largura: "6%" },
                    { titulo: "Pergunta", largura: "64%" },
                    { titulo: "Resposta", largura: "30%" },
                  ]}
                  linhas={v.respostas.map((x) => [
                    String(x.ordem),
                    x.pergunta,
                    x.resposta ?? "sem resposta",
                  ])}
                  vazio="Checklist sem perguntas."
                />
              </View>
            ))
          ) : (
            <T style={s.vazio}>Nenhuma vistoria no escopo.</T>
          )}
        </Secao>

        <Secao titulo="Movimentações">
          <Tabela
            colunas={[
              { titulo: "Código", largura: "11%" },
              { titulo: "Data", largura: "13%" },
              { titulo: "Item", largura: "11%" },
              { titulo: "Origem -> destino", largura: "25%" },
              { titulo: "Responsável", largura: "24%" },
              { titulo: "Situação", largura: "16%" },
            ]}
            linhas={snapshot.movimentacoes.map((m) => [
              m.codigo,
              dataHora(m.data_evento, c),
              `${m.alvo ?? "—"}${m.quantidade ? ` (${qtd(m.quantidade)})` : ""}`,
              `${m.origem ?? "—"} -> ${m.destino ?? "—"}`,
              `${m.responsavel_anterior ?? "—"} -> ${m.novo_responsavel ?? "—"}`,
              rotulo(ROTULO_STATUS_MOVIMENTACAO, m.status) +
                (m.aceite_administrativo ? " (aceite administrativo)" : ""),
            ])}
            vazio="Nenhuma movimentação no escopo."
          />
        </Secao>

        <Secao titulo="Ocorrências">
          <Tabela
            colunas={[
              { titulo: "Código", largura: "11%" },
              { titulo: "Tipo / prioridade", largura: "16%" },
              { titulo: "Item", largura: "10%" },
              { titulo: "Data / prazo", largura: "15%" },
              { titulo: "Descrição", largura: "30%" },
              { titulo: "Situação", largura: "18%" },
            ]}
            linhas={snapshot.ocorrencias.map((o) => [
              o.codigo,
              `${rotulo(ROTULO_TIPO_OCORRENCIA, o.tipo)} / ${rotulo(ROTULO_PRIORIDADE, o.prioridade)}`,
              o.alvo,
              `${dataHora(o.data_evento, c)}${o.prazo ? ` / ${dataHora(o.prazo, c)}` : ""}`,
              o.descricao + (o.resolucao ? ` — Resolução: ${o.resolucao}` : ""),
              rotulo(ROTULO_STATUS_OCORRENCIA, o.status) +
                (o.resultado ? ` (${rotulo(ROTULO_RESULTADO, o.resultado)})` : ""),
            ])}
            vazio="Nenhuma ocorrência no escopo."
          />
        </Secao>

        <Secao titulo="Devoluções e comprovantes">
          {snapshot.devolucoes.length ? (
            snapshot.devolucoes.map((d) => (
              <View key={d.codigo} wrap={false}>
                <T style={s.subsecao}>
                  {`${d.codigo} · ${rotulo(ROTULO_STATUS_DEVOLUCAO, d.status)} · solicitada ${dataHora(d.solicitada_em, c)} · retirada ${dataHora(d.retirada_em, c)}${d.recebedor ? ` · recebida por ${d.recebedor}` : ""} · ciência financeira ${dataHora(d.ciencia_financeira_em, c)}`}
                </T>
                <Tabela
                  colunas={[
                    { titulo: "Item", largura: "30%" },
                    { titulo: "Solicitado", largura: "20%" },
                    { titulo: "Retirado", largura: "20%" },
                    { titulo: "Condição de saída", largura: "30%" },
                  ]}
                  linhas={d.itens.map((x) => [
                    x.alvo,
                    qtd(x.solicitada),
                    qtd(x.retirada),
                    x.condicao ? rotulo(ROTULO_CONDICAO, x.condicao) : "—",
                  ])}
                  vazio="Sem itens."
                />
                {d.comprovantes.length ? (
                  d.comprovantes.map((x) => (
                    <T key={x.hash} style={s.legenda}>
                      {`Comprovante: ${x.nome ?? "arquivo"} · enviado em ${dataHora(x.enviada_em, c)} · SHA-256 ${hashLegivel(x.hash)}`}
                    </T>
                  ))
                ) : d.retirada_em ? (
                  <T style={s.vazio}>Comprovante ainda não anexado.</T>
                ) : null}
              </View>
            ))
          ) : (
            <T style={s.vazio}>Nenhuma devolução no escopo.</T>
          )}
        </Secao>

        {l && snapshot.incluir_valores ? (
          <Secao titulo="Estado financeiro e cobranças">
            <Tabela
              colunas={[
                { titulo: "Cobrança", largura: "15%" },
                { titulo: "Competência", largura: "30%" },
                { titulo: "Valor", largura: "20%" },
                { titulo: "Documento", largura: "17%" },
                { titulo: "Situação", largura: "18%" },
              ]}
              linhas={l.cobrancas.map((x) => [
                x.codigo,
                `${dataCivil(x.competencia_inicio)} a ${dataCivil(x.competencia_fim)}`,
                formatarMoeda(x.valor),
                x.documento,
                rotulo(ROTULO_STATUS_COBRANCA, x.status),
              ])}
              vazio="Nenhuma cobrança registrada."
            />
          </Secao>
        ) : null}

        {r.tipo !== "PERIODO" ? (
          <Secao titulo="Fotografias">
            {snapshot.evidencias_total > snapshot.evidencias.length ? (
              <T style={s.vazio}>
                {`Exibidas ${snapshot.evidencias.length} de ${snapshot.evidencias_total} evidências (limite por relatório). Gere relatórios por bem para ver as demais.`}
              </T>
            ) : null}
            {imagens.length ? (
              <View style={s.fotos}>
                {imagens.map((f) => (
                  <View key={f.evidencia.id} style={s.foto} wrap={false}>
                    {f.jpeg ? (
                      // eslint-disable-next-line jsx-a11y/alt-text -- PDF: a legenda abaixo descreve a foto
                      <Image src={{ data: f.jpeg, format: "jpg" }} style={s.imagem} />
                    ) : (
                      <T
                        style={s.vazio}
                      >{`Imagem indisponível (SHA-256 ${hashLegivel(f.evidencia.hash)}).`}</T>
                    )}
                    <T style={s.legenda}>{legendaFoto(f.evidencia, c)}</T>
                  </View>
                ))}
              </View>
            ) : (
              <T style={s.vazio}>Nenhuma fotografia no escopo.</T>
            )}
            {documentos.length ? (
              <>
                <T style={s.subsecao}>Documentos anexados (PDF)</T>
                {documentos.map((e) => (
                  <T key={e.id} style={s.legenda}>
                    {`${legendaFoto(e, c)} · ${e.nome ?? "arquivo"} · SHA-256 ${hashLegivel(e.hash)}`}
                  </T>
                ))}
              </>
            ) : null}
          </Secao>
        ) : null}

        <View style={s.rodape} fixed>
          <Text
            render={({ pageNumber, totalPages }) =>
              textoPdf(
                `${r.codigo} · ${VERSAO_TEMPLATE} · gerado em ${dataHora(geradoEm, c)} por ${r.solicitado_por} · SHA-256 dos dados: ${hashLegivel(hashDados)} · página ${pageNumber}/${totalPages}`,
              )
            }
          />
        </View>
      </Page>
    </Document>
  );
}
