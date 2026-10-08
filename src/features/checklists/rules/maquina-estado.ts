import { definirMaquina } from "@/lib/domain/maquina-estado";

/** RN-80: versão publicada é imutável; mudanças geram nova versão. */
export const maquinaChecklist = definirMaquina({
  nome: "checklist",
  estados: ["RASCUNHO", "PUBLICADO", "ARQUIVADO"],
  inicial: "RASCUNHO",
  transicoes: { RASCUNHO: ["PUBLICADO"], PUBLICADO: ["ARQUIVADO"], ARQUIVADO: [] },
});

export type StatusChecklist = (typeof maquinaChecklist.estados)[number];
