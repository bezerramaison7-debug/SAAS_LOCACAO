import { definirMaquina } from "@/lib/domain/maquina-estado";

/** docs/business-rules.md §4.6 — concluída é imutável (RN-83). */
export const maquinaVistoria = definirMaquina({
  nome: "vistoria",
  estados: ["RASCUNHO", "CONCLUIDA", "CANCELADA"],
  inicial: "RASCUNHO",
  transicoes: { RASCUNHO: ["CONCLUIDA", "CANCELADA"], CONCLUIDA: [], CANCELADA: [] },
});

export type StatusVistoria = (typeof maquinaVistoria.estados)[number];
