import { definirMaquina } from "@/lib/domain/maquina-estado";

/** docs/business-rules.md §4.10 */
export const maquinaCobranca = definirMaquina({
  nome: "cobranca",
  estados: ["PENDENTE", "CONFERIDA", "DIVERGENTE", "RESOLVIDA"],
  inicial: "PENDENTE",
  transicoes: {
    PENDENTE: ["CONFERIDA", "DIVERGENTE"],
    CONFERIDA: ["DIVERGENTE"],
    DIVERGENTE: ["RESOLVIDA"],
    RESOLVIDA: [],
  },
});

export type StatusCobranca = (typeof maquinaCobranca.estados)[number];
