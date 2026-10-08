import Decimal from "decimal.js";
import { z } from "zod";

import { parseMoedaBR } from "@/lib/format/moeda";
import { uuidSchema } from "@/lib/validation/comum";

import { PERIODICIDADES, SISTEMAS_EXTERNOS, TIPOS_REFERENCIA } from "./rotulos";

function textoOpcional(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .transform((v) => (v === "" ? null : v));
}

const dataOpcional = z
  .string()
  .trim()
  .refine((v) => v === "" || z.iso.date().safeParse(v).success, "Data inválida")
  .transform((v) => (v === "" ? null : v));

export const identificacaoSchema = z.object({
  fornecedorId: uuidSchema
    .or(z.literal("").transform(() => null))
    .refine((v) => v !== null, "Selecione o fornecedor"),
  centroCustoId: uuidSchema
    .or(z.literal("").transform(() => null))
    .refine((v) => v !== null, "Selecione o centro de custo"),
  observacoes: textoOpcional(4000),
});
export const CAMPOS_IDENTIFICACAO = ["fornecedorId", "centroCustoId", "observacoes"] as const;

export const referenciaSchema = z.object({
  sistema: z.enum(SISTEMAS_EXTERNOS, "Selecione o sistema"),
  tipo: z.enum(TIPOS_REFERENCIA, "Selecione o tipo de documento"),
  numero: z.string().trim().min(1, "Informe o número").max(60, "Máximo de 60 caracteres"),
  dataDocumento: dataOpcional,
  observacao: textoOpcional(1000),
});
export const CAMPOS_REFERENCIA = [
  "sistema",
  "tipo",
  "numero",
  "dataDocumento",
  "observacao",
] as const;

/** Quantidade digitada em pt-BR ("1.234,5") → string decimal canônica, ou null. */
export function parseQuantidadeBR(texto: string): string | null {
  const limpo = texto.replace(/\s/g, "");
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,3})?$|^\d+(,\d{1,3})?$/.test(limpo)) return null;
  return new Decimal(limpo.replace(/\./g, "").replace(",", ".")).toString();
}

const LIMITE_INTEIROS_QTD = new Decimal("99999999999.999"); // numeric(14,3)
const LIMITE_MOEDA = new Decimal("999999999999.99"); // numeric(14,2)

/** Item contratado. O modo vem da categoria (no servidor), não do formulário. */
export function itemSchema(modo: "INDIVIDUAL" | "LOTE") {
  return z.object({
    categoriaId: uuidSchema,
    descricao: z.string().trim().min(2, "Informe a descrição").max(300, "Máximo de 300 caracteres"),
    quantidade: z.string().transform((v, ctx) => {
      const q = parseQuantidadeBR(v);
      if (q === null || new Decimal(q).lte(0) || new Decimal(q).gt(LIMITE_INTEIROS_QTD)) {
        ctx.addIssue({
          code: "custom",
          message: "Informe uma quantidade maior que zero (ex.: 10 ou 2,5)",
        });
        return z.NEVER;
      }
      if (modo === "INDIVIDUAL" && !new Decimal(q).isInteger()) {
        ctx.addIssue({ code: "custom", message: "Controle individual exige quantidade inteira" });
        return z.NEVER;
      }
      return q;
    }),
    unidade: z.string().trim().min(1, "Informe a unidade").max(20, "Máximo de 20 caracteres"),
    valorUnitario: z.string().transform((v, ctx) => {
      const valor = parseMoedaBR(v);
      if (valor === null || new Decimal(valor).lt(0) || new Decimal(valor).gt(LIMITE_MOEDA)) {
        ctx.addIssue({ code: "custom", message: "Informe um valor válido (ex.: 1.234,56)" });
        return z.NEVER;
      }
      return valor;
    }),
    periodicidade: z.enum(PERIODICIDADES, "Selecione a periodicidade"),
    observacao: textoOpcional(1000),
  });
}
export const CAMPOS_ITEM = [
  "categoriaId",
  "descricao",
  "quantidade",
  "unidade",
  "valorUnitario",
  "periodicidade",
  "observacao",
] as const;

export const vigenciaSchema = z
  .object({
    inicioPrevisto: z.iso.date("Informe a data de início"),
    terminoPrevisto: z.iso.date("Informe a data de término"),
  })
  .refine((d) => d.terminoPrevisto >= d.inicioPrevisto, {
    path: ["terminoPrevisto"],
    message: "O término deve ser igual ou posterior ao início",
  });
export const CAMPOS_VIGENCIA = ["inicioPrevisto", "terminoPrevisto"] as const;

export const ETAPAS = ["identificacao", "referencias", "itens", "vigencia", "revisao"] as const;
export type Etapa = (typeof ETAPAS)[number];
export const ROTULO_ETAPA: Record<Etapa, string> = {
  identificacao: "Identificação",
  referencias: "Referências Sectra",
  itens: "Itens",
  vigencia: "Vigência",
  revisao: "Revisão e ativação",
};

export function lerEtapa(valor: string | string[] | undefined): Etapa {
  const v = Array.isArray(valor) ? valor[0] : valor;
  return (ETAPAS as readonly string[]).includes(v ?? "") ? (v as Etapa) : "identificacao";
}

export const ABAS = [
  "resumo",
  "itens",
  "recebimentos",
  "bens",
  "movimentacoes",
  "evidencias",
  "devolucoes",
  "cobrancas",
  "historico",
] as const;
export type Aba = (typeof ABAS)[number];

export function lerAba(valor: string | string[] | undefined): Aba {
  const v = Array.isArray(valor) ? valor[0] : valor;
  return (ABAS as readonly string[]).includes(v ?? "") ? (v as Aba) : "resumo";
}
