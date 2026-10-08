export const CONDICOES = ["NOVO", "BOM", "REGULAR", "AVARIADO"] as const;
export type Condicao = (typeof CONDICOES)[number];
export const ROTULO_CONDICAO: Record<Condicao, string> = {
  NOVO: "Novo",
  BOM: "Bom",
  REGULAR: "Regular",
  AVARIADO: "Avariado",
};

export const STATUS_RECEBIMENTO = [
  "RASCUNHO",
  "AGUARDANDO_AUTORIZACAO",
  "CONFIRMADO",
  "CANCELADO",
] as const;
export type StatusRecebimento = (typeof STATUS_RECEBIMENTO)[number];
export const TOM_STATUS_RECEBIMENTO = {
  RASCUNHO: "alerta",
  AGUARDANDO_AUTORIZACAO: "perigo",
  CONFIRMADO: "sucesso",
  CANCELADO: "neutro",
} as const satisfies Record<StatusRecebimento, string>;

/** Etapas do fluxo mobile (F5.2). A etapa 1 (locação) acontece na criação do rascunho. */
export const ETAPAS_RECEBIMENTO = ["itens", "fotos", "checklist", "destino", "revisao"] as const;
export type EtapaRecebimento = (typeof ETAPAS_RECEBIMENTO)[number];
export const ROTULO_ETAPA_RECEBIMENTO: Record<EtapaRecebimento, string> = {
  itens: "Itens e identificação",
  fotos: "Fotos",
  checklist: "Checklist de entrada",
  destino: "Local e responsável",
  revisao: "Revisão e confirmação",
};

export function lerEtapaRecebimento(valor: string | string[] | undefined): EtapaRecebimento {
  const v = Array.isArray(valor) ? valor[0] : valor;
  return (ETAPAS_RECEBIMENTO as readonly string[]).includes(v ?? "")
    ? (v as EtapaRecebimento)
    : "itens";
}
