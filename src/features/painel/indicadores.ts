import "server-only";

import Decimal from "decimal.js";
import { type Route } from "next";

import { listarBens, listarLotes } from "@/features/bens/queries";
import { listarCobrancas } from "@/features/cobrancas/queries";
import { listarDevolucoes } from "@/features/devolucoes/queries";
import { lerFiltrosLocacao } from "@/features/locacoes/filtros";
import { buscarLocacoes } from "@/features/locacoes/queries";
import { listarMovimentacoes } from "@/features/movimentacoes/queries";
import { listarOcorrencias } from "@/features/ocorrencias/queries";
import { listarVistorias } from "@/features/vistorias/queries";
import { pode } from "@/lib/auth/autorizacao";
import { type Contexto } from "@/lib/auth/contexto";
import { formatarQuantidade } from "@/lib/format/moeda";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type Paginacao } from "@/lib/validation/comum";

/**
 * Indicadores do painel (§5.2). Cada número vem da MESMA consulta da lista que
 * o link abre (mesmos filtros, mesma RLS), então o total da lista sempre bate
 * com o indicador (CA-72). Para RESPONSAVEL_LOCAL a RLS já restringe tudo aos
 * itens sob a responsabilidade dele.
 */
export type Indicador = {
  id: string;
  titulo: string;
  valor: number;
  /** Regra de cálculo exibida junto ao número. */
  regra: string;
  href: Route;
  tom: "neutro" | "alerta" | "perigo";
};

export type GrupoIndicadores = { titulo: string; itens: Indicador[] };

const PAGINA: Paginacao = { pagina: 1, tamanho: 25 };

export async function indicadoresDoPainel(contexto: Contexto) {
  const geral = pode(contexto, "dados.ler_geral");
  const valores = pode(contexto, "valores.ver");
  const responsavelLocal = contexto.papel === "RESPONSAVEL_LOCAL";
  const total = <T extends { total: number }>(p: Promise<T>) => p.then((r) => r.total);
  const locacoes = (params: Record<string, string>) =>
    total(buscarLocacoes(contexto, lerFiltrosLocacao(params)));
  const zero = Promise.resolve(0);
  const bensFiltro = {
    q: "",
    local: null,
    meus: false,
    situacao: "ativos" as const,
    paginacao: PAGINA,
  };

  const [
    ativas,
    termino7,
    termino15,
    termino30,
    vencidas,
    bensAtivos,
    lotesAtivos,
    devolucoesAbertas,
    vistoriasIncompletas,
    semComprovante,
    semDocumento,
    ocorrenciasAbertas,
    ocorrenciasVencidas,
    divergencias,
    encerramentosPendentes,
    semCiencia,
    aceites,
    saldoLotes,
    alertasTermino,
    alertasOcorrencias,
  ] = await Promise.all([
    locacoes({ status: "ATIVA,EM_DEVOLUCAO" }),
    locacoes({ termino: "7" }),
    locacoes({ termino: "15" }),
    locacoes({ termino: "30" }),
    locacoes({ termino: "vencido" }),
    total(listarBens(contexto, bensFiltro)),
    total(listarLotes(contexto, bensFiltro)),
    geral
      ? total(
          listarDevolucoes(contexto, {
            q: "",
            visao: "ABERTAS",
            pendencia: null,
            paginacao: PAGINA,
          }),
        )
      : zero,
    total(listarVistorias(contexto, { status: "RASCUNHO", paginacao: PAGINA })),
    geral
      ? total(
          listarDevolucoes(contexto, {
            q: "",
            visao: "TODAS",
            pendencia: "comprovante",
            paginacao: PAGINA,
          }),
        )
      : zero,
    valores
      ? total(
          listarCobrancas(contexto, {
            q: "",
            visao: "TODAS",
            semDocumento: true,
            paginacao: PAGINA,
          }),
        )
      : zero,
    total(
      listarOcorrencias(contexto, {
        q: "",
        status: "EM_ABERTO",
        tipo: null,
        vencidas: false,
        paginacao: PAGINA,
      }),
    ),
    total(
      listarOcorrencias(contexto, {
        q: "",
        status: null,
        tipo: null,
        vencidas: true,
        paginacao: PAGINA,
      }),
    ),
    valores
      ? total(
          listarCobrancas(contexto, {
            q: "",
            visao: "DIVERGENTES",
            semDocumento: false,
            paginacao: PAGINA,
          }),
        )
      : zero,
    valores ? locacoes({ financeiro: "ENCERRAMENTO_PENDENTE" }) : zero,
    geral && valores
      ? total(
          listarDevolucoes(contexto, {
            q: "",
            visao: "TODAS",
            pendencia: "ciencia",
            paginacao: PAGINA,
          }),
        )
      : zero,
    total(
      listarMovimentacoes(contexto, {
        status: "PENDENTE_ACEITE",
        paraMim: responsavelLocal,
        paginacao: PAGINA,
      }),
    ),
    saldoDeLotesPorUnidade(contexto),
    buscarLocacoes(contexto, lerFiltrosLocacao({ termino: "7" })).then((r) => r.linhas.slice(0, 5)),
    listarOcorrencias(contexto, {
      q: "",
      status: null,
      tipo: null,
      vencidas: true,
      paginacao: PAGINA,
    }).then((r) => r.linhas.slice(0, 5)),
  ]);

  const grupos: GrupoIndicadores[] = [
    {
      titulo: "Operação",
      itens: [
        {
          id: "locacoes-ativas",
          titulo: "Locações ativas",
          valor: ativas,
          regra: "Situação Ativa ou Em devolução.",
          href: "/locacoes?status=ATIVA,EM_DEVOLUCAO",
          tom: "neutro",
        },
        {
          id: "bens-ativos",
          titulo: "Bens ativos",
          valor: bensAtivos,
          regra:
            "Bens ainda sob responsabilidade da empresa: disponível, em uso, em transferência, em manutenção, devolução solicitada ou extraviado.",
          href: "/bens?situacao=ativos",
          tom: "neutro",
        },
        {
          id: "lotes-ativos",
          titulo: "Lotes com saldo",
          valor: lotesAtivos,
          regra: `Lotes ativos (saldo > 0). Saldo total: ${
            saldoLotes.length
              ? saldoLotes.map((s) => `${s.quantidade} ${s.unidade}`).join(" · ")
              : "0"
          }.`,
          href: "/bens?tipo=lotes&situacao=ativos",
          tom: "neutro",
        },
        {
          id: "vistorias-incompletas",
          titulo: "Vistorias incompletas",
          valor: vistoriasIncompletas,
          regra: "Vistorias em andamento (rascunho), de qualquer tipo.",
          href: "/vistorias?status=RASCUNHO",
          tom: vistoriasIncompletas ? "alerta" : "neutro",
        },
        {
          id: "aceites",
          titulo: responsavelLocal
            ? "Transferências para você aceitar"
            : "Movimentações aguardando aceite",
          valor: aceites,
          regra: responsavelLocal
            ? "Transferências pendentes destinadas a você."
            : "Movimentações com aceite pendente do novo responsável.",
          href: responsavelLocal
            ? "/movimentacoes?status=PENDENTE_ACEITE&para=mim"
            : "/movimentacoes?status=PENDENTE_ACEITE",
          tom: aceites ? "alerta" : "neutro",
        },
      ],
    },
    {
      titulo: "Prazos",
      itens: [
        ...(
          [
            [7, termino7],
            [15, termino15],
            [30, termino30],
          ] as const
        ).map(([dias, valor]) => ({
          id: `termino-${dias}`,
          titulo: `Términos em ${dias} dias`,
          valor,
          regra: `Locações ativas ou em devolução com término previsto entre hoje e daqui a ${dias} dias (fuso da empresa), cumulativo.`,
          href: `/locacoes?termino=${dias}` as Route,
          tom: valor && dias === 7 ? ("alerta" as const) : ("neutro" as const),
        })),
        {
          id: "termino-vencido",
          titulo: "Términos vencidos",
          valor: vencidas,
          regra: "Término previsto antes de hoje e itens ainda sob responsabilidade da empresa.",
          href: "/locacoes?termino=vencido",
          tom: vencidas ? "perigo" : "neutro",
        },
        {
          id: "ocorrencias-abertas",
          titulo: "Ocorrências abertas",
          valor: ocorrenciasAbertas,
          regra: "Ocorrências abertas ou em tratamento.",
          href: "/ocorrencias?visao=EM_ABERTO",
          tom: ocorrenciasAbertas ? "alerta" : "neutro",
        },
        {
          id: "ocorrencias-vencidas",
          titulo: "Ocorrências vencidas",
          valor: ocorrenciasVencidas,
          regra: "Abertas ou em tratamento com prazo anterior a agora.",
          href: "/ocorrencias?visao=VENCIDAS",
          tom: ocorrenciasVencidas ? "perigo" : "neutro",
        },
      ],
    },
    ...(geral
      ? [
          {
            titulo: "Devoluções e evidências",
            itens: [
              {
                id: "devolucoes-abertas",
                titulo: "Devoluções aguardando retirada",
                valor: devolucoesAbertas,
                regra: "Devoluções solicitadas ou agendadas.",
                href: "/devolucoes?visao=ABERTAS" as Route,
                tom: "neutro" as const,
              },
              {
                id: "sem-comprovante",
                titulo: "Devoluções sem comprovante",
                valor: semComprovante,
                regra: "Evidência pendente: retirada confirmada sem comprovante ativo anexado.",
                href: "/devolucoes?pendencia=comprovante" as Route,
                tom: semComprovante ? ("alerta" as const) : ("neutro" as const),
              },
              ...(valores
                ? [
                    {
                      id: "sem-documento",
                      titulo: "Cobranças sem documento",
                      valor: semDocumento,
                      regra: "Evidência pendente: cobrança sem documento anexado.",
                      href: "/cobrancas?pendencia=documento" as Route,
                      tom: semDocumento ? ("alerta" as const) : ("neutro" as const),
                    },
                  ]
                : []),
            ],
          },
        ]
      : []),
    ...(valores
      ? [
          {
            titulo: "Financeiro",
            itens: [
              {
                id: "divergencias",
                titulo: "Divergências financeiras",
                valor: divergencias,
                regra: "Cobranças marcadas como divergentes e ainda não resolvidas.",
                href: "/cobrancas?visao=DIVERGENTES" as Route,
                tom: divergencias ? ("perigo" as const) : ("neutro" as const),
              },
              {
                id: "encerramentos-pendentes",
                titulo: "Encerramentos financeiros pendentes",
                valor: encerramentosPendentes,
                regra:
                  "Locações com saldo zerado aguardando a confirmação do encerramento financeiro.",
                href: "/locacoes?financeiro=ENCERRAMENTO_PENDENTE" as Route,
                tom: encerramentosPendentes ? ("alerta" as const) : ("neutro" as const),
              },
              ...(geral
                ? [
                    {
                      id: "sem-ciencia",
                      titulo: "Devoluções sem ciência financeira",
                      valor: semCiencia,
                      regra: "Retiradas confirmadas sem a ciência do financeiro (RN-56).",
                      href: "/devolucoes?pendencia=ciencia" as Route,
                      tom: semCiencia ? ("alerta" as const) : ("neutro" as const),
                    },
                  ]
                : []),
            ],
          },
        ]
      : []),
  ];

  return { grupos, alertas: { terminos: alertasTermino, ocorrencias: alertasOcorrencias } };
}

/** Σ saldo dos lotes ATIVO por unidade de medida (RLS de quem consulta). */
async function saldoDeLotesPorUnidade(contexto: Contexto) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("lotes")
    .select("saldo::text, itens_locacao(unidade)")
    .eq("empresa_id", contexto.empresa.id)
    .eq("status", "ATIVO")
    .limit(5000);
  if (error) throw new Error("Falha ao somar saldo de lotes");
  const soma = new Map<string, Decimal>();
  for (const l of data ?? []) {
    const unidade = l.itens_locacao?.unidade ?? "un";
    soma.set(unidade, (soma.get(unidade) ?? new Decimal(0)).plus(l.saldo));
  }
  return [...soma.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
    .map(([unidade, q]) => ({
      unidade,
      quantidade: formatarQuantidade(q),
    }));
}
