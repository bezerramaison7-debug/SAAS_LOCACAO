import { definirMaquina } from "@/lib/domain/maquina-estado";

/** docs/business-rules.md §4.5 */
export const maquinaRecebimento = definirMaquina({
  nome: "recebimento",
  estados: ["RASCUNHO", "AGUARDANDO_AUTORIZACAO", "CONFIRMADO", "CANCELADO"],
  inicial: "RASCUNHO",
  transicoes: {
    RASCUNHO: ["CONFIRMADO", "AGUARDANDO_AUTORIZACAO", "CANCELADO"],
    AGUARDANDO_AUTORIZACAO: ["CONFIRMADO", "RASCUNHO", "CANCELADO"],
    // Cancelamento de confirmado: só ADMIN e sem eventos posteriores (RN-28).
    CONFIRMADO: ["CANCELADO"],
    CANCELADO: [],
  },
});

export type StatusRecebimento = (typeof maquinaRecebimento.estados)[number];
