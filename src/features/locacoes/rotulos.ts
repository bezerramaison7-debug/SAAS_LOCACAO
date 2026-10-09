import { type StatusFinanceiro, type StatusLocacao } from "./rules/maquina-estado";

export const ROTULO_STATUS_LOCACAO: Record<StatusLocacao, string> = {
  RASCUNHO: "Rascunho",
  ATIVA: "Ativa",
  EM_DEVOLUCAO: "Em devolução",
  ENCERRADA_OPERACIONALMENTE: "Encerrada (operacional)",
  CANCELADA: "Cancelada",
};

export const TOM_STATUS_LOCACAO = {
  RASCUNHO: "alerta",
  ATIVA: "sucesso",
  EM_DEVOLUCAO: "info",
  ENCERRADA_OPERACIONALMENTE: "neutro",
  CANCELADA: "perigo",
} as const satisfies Record<StatusLocacao, string>;

export const ROTULO_STATUS_FINANCEIRO: Record<StatusFinanceiro, string> = {
  NAO_INICIADO: "Não iniciado",
  EM_COBRANCA: "Em cobrança",
  ENCERRAMENTO_PENDENTE: "Encerramento pendente",
  ENCERRADO: "Encerrado",
};

export const PERIODICIDADES = ["DIARIA", "SEMANAL", "QUINZENAL", "MENSAL"] as const;
export type Periodicidade = (typeof PERIODICIDADES)[number];
export const ROTULO_PERIODICIDADE: Record<Periodicidade, string> = {
  DIARIA: "Diária",
  SEMANAL: "Semanal",
  QUINZENAL: "Quinzenal",
  MENSAL: "Mensal",
};

export const TIPOS_REFERENCIA = [
  "PEDIDO",
  "REQUISICAO",
  "SOLICITACAO",
  "CONTRATO",
  "NOTA_FISCAL",
  "OUTRO",
] as const;
export type TipoReferencia = (typeof TIPOS_REFERENCIA)[number];
export const ROTULO_TIPO_REFERENCIA: Record<TipoReferencia, string> = {
  PEDIDO: "Pedido de compra",
  REQUISICAO: "Requisição",
  SOLICITACAO: "Solicitação",
  CONTRATO: "Contrato",
  NOTA_FISCAL: "Nota fiscal",
  OUTRO: "Outro",
};

export const SISTEMAS_EXTERNOS = ["SECTRA", "OUTRO"] as const;
export type SistemaExterno = (typeof SISTEMAS_EXTERNOS)[number];
export const ROTULO_SISTEMA: Record<SistemaExterno, string> = {
  SECTRA: "Sectra",
  OUTRO: "Outro sistema",
};
