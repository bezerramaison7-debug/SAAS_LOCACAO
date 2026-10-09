import { definirMaquina } from "@/lib/domain/maquina-estado";

/**
 * docs/business-rules.md §4.3 (inclui extensões aceitas D-12/S-06).
 * "Estado anterior" (retorno de manutenção, devolução não retirada, extravio
 * encontrado) é gravado no evento que causou a transição.
 */
export const maquinaBem = definirMaquina({
  nome: "bem",
  estados: [
    "AGUARDANDO_RECEBIMENTO",
    "DISPONIVEL",
    "EM_USO",
    "EM_TRANSFERENCIA",
    "EM_MANUTENCAO",
    "DEVOLUCAO_SOLICITADA",
    "DEVOLVIDO",
    "EXTRAVIADO",
    "SUBSTITUIDO",
    "BAIXADO",
    "CANCELADO",
  ],
  inicial: "AGUARDANDO_RECEBIMENTO",
  transicoes: {
    AGUARDANDO_RECEBIMENTO: ["DISPONIVEL", "CANCELADO"],
    DISPONIVEL: [
      "EM_USO",
      "DEVOLUCAO_SOLICITADA",
      "EM_MANUTENCAO",
      "EXTRAVIADO",
      "SUBSTITUIDO",
      "CANCELADO",
    ],
    EM_USO: [
      "EM_TRANSFERENCIA",
      "DEVOLUCAO_SOLICITADA",
      "EM_MANUTENCAO",
      "EXTRAVIADO",
      "SUBSTITUIDO",
      "CANCELADO",
    ],
    EM_TRANSFERENCIA: ["EM_USO", "EXTRAVIADO"],
    EM_MANUTENCAO: ["EM_USO", "DISPONIVEL", "EXTRAVIADO", "SUBSTITUIDO"],
    DEVOLUCAO_SOLICITADA: ["DEVOLVIDO", "EM_USO", "DISPONIVEL", "EXTRAVIADO"],
    EXTRAVIADO: ["DISPONIVEL", "EM_USO", "EM_MANUTENCAO", "DEVOLUCAO_SOLICITADA", "BAIXADO"],
    DEVOLVIDO: [],
    SUBSTITUIDO: [],
    BAIXADO: [],
    CANCELADO: [],
  },
});

/** docs/business-rules.md §4.4 */
export const maquinaLote = definirMaquina({
  nome: "lote",
  estados: ["ATIVO", "ENCERRADO", "CANCELADO"],
  inicial: "ATIVO",
  transicoes: {
    ATIVO: ["ENCERRADO", "CANCELADO"],
    // Reabertura apenas por cancelamento administrativo de retirada (D-15).
    ENCERRADO: ["ATIVO"],
    CANCELADO: [],
  },
});

export type StatusBem = (typeof maquinaBem.estados)[number];
export type StatusLote = (typeof maquinaLote.estados)[number];

/** Bens que continuam sob responsabilidade da empresa (§5.1; EXTRAVIADO conta — RN-43). */
export const STATUS_BEM_ATIVOS = [
  "DISPONIVEL",
  "EM_USO",
  "EM_TRANSFERENCIA",
  "EM_MANUTENCAO",
  "DEVOLUCAO_SOLICITADA",
  "EXTRAVIADO",
] as const satisfies readonly StatusBem[];

export function bemEstaAtivo(status: StatusBem): boolean {
  return (STATUS_BEM_ATIVOS as readonly StatusBem[]).includes(status);
}
