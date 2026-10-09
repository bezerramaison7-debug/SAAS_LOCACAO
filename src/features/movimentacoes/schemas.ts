import Decimal from "decimal.js";
import { z } from "zod";

import { parseQuantidadeBR } from "@/features/locacoes/schemas";
import { horarioLocalParaUtc } from "@/lib/format/datas";
import { TOLERANCIA_FUTURO_MS, uuidSchema } from "@/lib/validation/comum";

/** Data do fato no horário da empresa → UTC, nunca no futuro (RN-102). */
export function dataFatoSchema(fuso: string, agora: () => number = Date.now) {
  return z.string().transform((v, ctx) => {
    let iso: string;
    try {
      iso = horarioLocalParaUtc(v, fuso);
    } catch {
      ctx.addIssue({ code: "custom", message: "Informe data e hora válidas" });
      return z.NEVER;
    }
    if (new Date(iso).getTime() > agora() + TOLERANCIA_FUTURO_MS) {
      ctx.addIssue({ code: "custom", message: "A data não pode estar no futuro" });
      return z.NEVER;
    }
    return iso;
  });
}

const selecionado = (mensagem: string) =>
  uuidSchema.or(z.literal("")).refine((v) => v !== "", mensagem);

export function movimentacaoSchema(fuso: string, agora: () => number = Date.now) {
  return z
    .object({
      destinoLocalId: selecionado("Selecione o local de destino"),
      novoResponsavelId: selecionado("Selecione o novo responsável"),
      dataEvento: dataFatoSchema(fuso, agora),
      motivo: z.string().trim().min(3, "Informe o motivo").max(1000, "Máximo de 1000 caracteres"),
      quantidade: z.string().trim(),
      correcao: z
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
      if (d.correcao && d.motivo.length < 10) {
        ctx.addIssue({
          code: "custom",
          path: ["motivo"],
          message: "Correção exige motivo com pelo menos 10 caracteres",
        });
        return z.NEVER;
      }
      return { ...d, quantidade };
    });
}

export const CAMPOS_MOVIMENTACAO = [
  "destinoLocalId",
  "novoResponsavelId",
  "dataEvento",
  "motivo",
  "quantidade",
  "correcao",
] as const;
