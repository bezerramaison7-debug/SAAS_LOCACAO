import { definirMaquina } from "@/lib/domain/maquina-estado";

/** docs/business-rules.md §4.1 */
export const maquinaLocacao = definirMaquina({
  nome: "locacao",
  estados: ["RASCUNHO", "ATIVA", "EM_DEVOLUCAO", "ENCERRADA_OPERACIONALMENTE", "CANCELADA"],
  inicial: "RASCUNHO",
  transicoes: {
    RASCUNHO: ["ATIVA", "CANCELADA"],
    ATIVA: ["EM_DEVOLUCAO", "CANCELADA"],
    // EM_DEVOLUCAO → ATIVA somente automática (cancelamento da devolução total — D-15).
    EM_DEVOLUCAO: ["ENCERRADA_OPERACIONALMENTE", "ATIVA"],
    ENCERRADA_OPERACIONALMENTE: [],
    CANCELADA: [],
  },
});

/**
 * docs/business-rules.md §4.2 — independente da máquina operacional (RN-62).
 * RETIRADA_CONFIRMADA nunca leva a ENCERRADO; só a ENCERRAMENTO_PENDENTE.
 */
export const maquinaFinanceiro = definirMaquina({
  nome: "financeiro",
  estados: ["NAO_INICIADO", "EM_COBRANCA", "ENCERRAMENTO_PENDENTE", "ENCERRADO"],
  inicial: "NAO_INICIADO",
  transicoes: {
    NAO_INICIADO: ["EM_COBRANCA", "ENCERRAMENTO_PENDENTE"],
    EM_COBRANCA: ["ENCERRAMENTO_PENDENTE"],
    ENCERRAMENTO_PENDENTE: ["ENCERRADO", "EM_COBRANCA"],
    ENCERRADO: [],
  },
});

export type StatusLocacao = (typeof maquinaLocacao.estados)[number];
export type StatusFinanceiro = (typeof maquinaFinanceiro.estados)[number];
