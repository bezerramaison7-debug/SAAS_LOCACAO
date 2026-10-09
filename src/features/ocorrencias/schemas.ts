import Decimal from "decimal.js";
import { z } from "zod";

import { parseQuantidadeBR } from "@/features/locacoes/schemas";
import { dataFatoSchema } from "@/features/movimentacoes/schemas";
import { horarioLocalParaUtc } from "@/lib/format/datas";

import { PRIORIDADES, RESULTADOS, TIPOS_REGISTRAVEIS } from "./rotulos";

function prazoSchema(fuso: string) {
  return z.string().transform((v, ctx) => {
    if (v.trim() === "") return null;
    try {
      return horarioLocalParaUtc(v, fuso);
    } catch {
      ctx.addIssue({ code: "custom", message: "Prazo inválido" });
      return z.NEVER;
    }
  });
}

export function ocorrenciaSchema(fuso: string, agora: () => number = Date.now) {
  return z
    .object({
      tipo: z.enum(TIPOS_REGISTRAVEIS, "Selecione o tipo"),
      descricao: z
        .string()
        .trim()
        .min(10, "Descreva com pelo menos 10 caracteres")
        .max(4000, "Máximo de 4000 caracteres"),
      prioridade: z.enum(PRIORIDADES, "Selecione a prioridade"),
      dataEvento: dataFatoSchema(fuso, agora),
      prazo: prazoSchema(fuso),
      quantidade: z.string().trim(),
      manutencao: z
        .enum(["on", ""])
        .optional()
        .transform((v) => v === "on"),
    })
    .transform((d, ctx) => {
      let quantidade: string | null = null;
      if (d.quantidade !== "") {
        quantidade = parseQuantidadeBR(d.quantidade);
        if (quantidade === null || new Decimal(quantidade).lte(0)) {
          ctx.addIssue({
            code: "custom",
            path: ["quantidade"],
            message: "Informe uma quantidade maior que zero",
          });
          return z.NEVER;
        }
      }
      if (d.manutencao && d.tipo !== "DEFEITO" && d.tipo !== "AVARIA") {
        ctx.addIssue({
          code: "custom",
          path: ["manutencao"],
          message: "Manutenção vale para defeito ou avaria",
        });
        return z.NEVER;
      }
      return { ...d, quantidade };
    });
}
export const CAMPOS_OCORRENCIA = [
  "tipo",
  "descricao",
  "prioridade",
  "dataEvento",
  "prazo",
  "quantidade",
  "manutencao",
] as const;

export const resolucaoSchema = z.object({
  resultado: z.enum(RESULTADOS, "Selecione o resultado"),
  resolucao: z
    .string()
    .trim()
    .min(10, "Descreva a resolução com pelo menos 10 caracteres")
    .max(4000),
});

export function tratamentoSchema(fuso: string) {
  return z.object({
    responsavelId: z.string().trim(),
    prazo: prazoSchema(fuso),
  });
}
