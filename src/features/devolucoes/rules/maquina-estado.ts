import { definirMaquina } from "@/lib/domain/maquina-estado";

/**
 * docs/business-rules.md §4.9 — etapas independentes. RETIRADA_CONFIRMADA
 * altera o saldo, mas NÃO encerra a cobrança (RN-55).
 */
export const maquinaDevolucao = definirMaquina({
  nome: "devolucao",
  estados: ["RASCUNHO", "SOLICITADA", "AGENDADA", "RETIRADA_CONFIRMADA", "CONFERIDA", "CANCELADA"],
  inicial: "RASCUNHO",
  transicoes: {
    RASCUNHO: ["SOLICITADA", "CANCELADA"],
    SOLICITADA: ["AGENDADA", "CANCELADA"],
    AGENDADA: ["RETIRADA_CONFIRMADA", "CANCELADA"],
    RETIRADA_CONFIRMADA: ["CONFERIDA"],
    CONFERIDA: [],
    CANCELADA: [],
  },
});

export type StatusDevolucao = (typeof maquinaDevolucao.estados)[number];
