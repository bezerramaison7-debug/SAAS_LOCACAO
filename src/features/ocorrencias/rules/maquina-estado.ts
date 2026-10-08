import { definirMaquina } from "@/lib/domain/maquina-estado";

/** docs/business-rules.md §4.8 — reabertura RESOLVIDA → ABERTA exige motivo. */
export const maquinaOcorrencia = definirMaquina({
  nome: "ocorrencia",
  estados: ["ABERTA", "EM_TRATAMENTO", "RESOLVIDA", "CANCELADA"],
  inicial: "ABERTA",
  transicoes: {
    ABERTA: ["EM_TRATAMENTO", "RESOLVIDA", "CANCELADA"],
    EM_TRATAMENTO: ["RESOLVIDA", "CANCELADA"],
    RESOLVIDA: ["ABERTA"],
    CANCELADA: [],
  },
});

export type StatusOcorrencia = (typeof maquinaOcorrencia.estados)[number];
