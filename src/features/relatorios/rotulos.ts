export const TIPOS_RELATORIO = ["LOCACAO", "BEM", "LOCAL", "PERIODO"] as const;
export type TipoRelatorio = (typeof TIPOS_RELATORIO)[number];
export const ROTULO_TIPO_RELATORIO: Record<TipoRelatorio, string> = {
  LOCACAO: "Locação",
  BEM: "Bem",
  LOCAL: "Local",
  PERIODO: "Período",
};
export const ROTULO_STATUS_RELATORIO: Record<string, string> = {
  PENDENTE: "Na fila",
  PROCESSANDO: "Gerando…",
  CONCLUIDO: "Pronto",
  ERRO: "Erro",
};
export const TOM_STATUS_RELATORIO = {
  PENDENTE: "info",
  PROCESSANDO: "info",
  CONCLUIDO: "sucesso",
  ERRO: "perigo",
} as const;
