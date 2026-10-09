export const TIPOS_OCORRENCIA = [
  "AVARIA",
  "DEFEITO",
  "EXTRAVIO",
  "DIVERGENCIA_QUANTIDADE",
  "DIVERGENCIA_DOCUMENTAL",
  "OUTRO",
  "TROCA",
] as const;
export type TipoOcorrencia = (typeof TIPOS_OCORRENCIA)[number];
export const ROTULO_TIPO_OCORRENCIA: Record<TipoOcorrencia, string> = {
  AVARIA: "Avaria",
  DEFEITO: "Defeito",
  EXTRAVIO: "Extravio",
  DIVERGENCIA_QUANTIDADE: "Divergência de quantidade",
  DIVERGENCIA_DOCUMENTAL: "Divergência documental",
  OUTRO: "Outro",
  TROCA: "Troca",
};
/** Tipos que o usuário registra manualmente (troca tem ação própria). */
export const TIPOS_REGISTRAVEIS = [
  "AVARIA",
  "DEFEITO",
  "EXTRAVIO",
  "DIVERGENCIA_QUANTIDADE",
  "DIVERGENCIA_DOCUMENTAL",
  "OUTRO",
] as const satisfies readonly TipoOcorrencia[];

export const PRIORIDADES = ["BAIXA", "MEDIA", "ALTA", "CRITICA"] as const;
export type Prioridade = (typeof PRIORIDADES)[number];
export const ROTULO_PRIORIDADE: Record<Prioridade, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
  CRITICA: "Crítica",
};
export const TOM_PRIORIDADE = {
  BAIXA: "neutro",
  MEDIA: "info",
  ALTA: "alerta",
  CRITICA: "perigo",
} as const;

export const STATUS_OCORRENCIA = ["ABERTA", "EM_TRATAMENTO", "RESOLVIDA", "CANCELADA"] as const;
export type StatusOcorrencia = (typeof STATUS_OCORRENCIA)[number];
export const ROTULO_STATUS_OCORRENCIA: Record<StatusOcorrencia, string> = {
  ABERTA: "Aberta",
  EM_TRATAMENTO: "Em tratamento",
  RESOLVIDA: "Resolvida",
  CANCELADA: "Cancelada",
};

export const RESULTADOS = ["ENCONTRADO", "INDENIZADO", "REPARADO", "OUTRO"] as const;
export type Resultado = (typeof RESULTADOS)[number];
export const ROTULO_RESULTADO: Record<Resultado | "SUBSTITUIDO", string> = {
  ENCONTRADO: "Encontrado",
  INDENIZADO: "Indenizado",
  REPARADO: "Reparado",
  OUTRO: "Outro",
  SUBSTITUIDO: "Substituído",
};

/** RN-40: vencida = aberta/em tratamento com prazo no passado. */
export function vencida(o: { status: string; prazo: string | null }, agora = Date.now()): boolean {
  return (
    (o.status === "ABERTA" || o.status === "EM_TRATAMENTO") &&
    o.prazo !== null &&
    Date.parse(o.prazo) < agora
  );
}

/** Resultados aceitos por tipo (extravio só encontrado/indenizado). */
export function resultadosPara(tipo: TipoOcorrencia): readonly Resultado[] {
  return tipo === "EXTRAVIO" ? ["ENCONTRADO", "INDENIZADO"] : ["REPARADO", "OUTRO"];
}
