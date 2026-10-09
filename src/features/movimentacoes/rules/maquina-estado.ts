import { definirMaquina } from "@/lib/domain/maquina-estado";

/**
 * docs/business-rules.md §4.7 — sem aceite exigido, a movimentação já nasce
 * CONFIRMADA. Estados finais são imutáveis (RN-31).
 */
export const maquinaMovimentacao = definirMaquina({
  nome: "movimentacao",
  estados: ["PENDENTE_ACEITE", "CONFIRMADA", "RECUSADA", "CANCELADA"],
  inicial: "PENDENTE_ACEITE",
  transicoes: {
    PENDENTE_ACEITE: ["CONFIRMADA", "RECUSADA", "CANCELADA"],
    CONFIRMADA: [],
    RECUSADA: [],
    CANCELADA: [],
  },
});

export type StatusMovimentacao = (typeof maquinaMovimentacao.estados)[number];
