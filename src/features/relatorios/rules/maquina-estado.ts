import { definirMaquina } from "@/lib/domain/maquina-estado";

/** docs/business-rules.md §4.11 — ERRO → PENDENTE para nova tentativa. */
export const maquinaRelatorio = definirMaquina({
  nome: "relatorio",
  estados: ["PENDENTE", "PROCESSANDO", "CONCLUIDO", "ERRO"],
  inicial: "PENDENTE",
  transicoes: {
    PENDENTE: ["PROCESSANDO"],
    PROCESSANDO: ["CONCLUIDO", "ERRO"],
    ERRO: ["PENDENTE"],
    CONCLUIDO: [],
  },
});

export type StatusRelatorio = (typeof maquinaRelatorio.estados)[number];
