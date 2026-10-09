import Decimal from "decimal.js";
import { z } from "zod";

import { parseMoedaBR } from "@/lib/format/moeda";

const LIMITE = new Decimal("999999999999.99"); // numeric(14,2)

/** RN-70: competência, valor (pt-BR), documento e observação. */
export const cobrancaSchema = z
  .object({
    competenciaInicio: z.iso.date({ message: "Informe o início da competência" }),
    competenciaFim: z.iso.date({ message: "Informe o fim da competência" }),
    valor: z.string().transform((v, ctx) => {
      const d = parseMoedaBR(v);
      if (d === null || new Decimal(d).lt(0) || new Decimal(d).gt(LIMITE)) {
        ctx.addIssue({ code: "custom", message: "Informe um valor válido (ex.: 1.234,56)" });
        return z.NEVER;
      }
      return d;
    }),
    numeroDocumento: z
      .string()
      .trim()
      .max(60, "Máximo de 60 caracteres")
      .transform((v) => (v === "" ? null : v)),
    observacoes: z
      .string()
      .trim()
      .max(2000, "Máximo de 2000 caracteres")
      .transform((v) => (v === "" ? null : v)),
  })
  .refine((d) => d.competenciaFim >= d.competenciaInicio, {
    path: ["competenciaFim"],
    message: "O fim não pode ser antes do início",
  });

export const CAMPOS_COBRANCA = [
  "competenciaInicio",
  "competenciaFim",
  "valor",
  "numeroDocumento",
  "observacoes",
] as const;

/** Rótulo exigido em toda estimativa (RN-72). */
export const AVISO_ESTIMATIVA =
  "Estimativa operacional — não substitui nota fiscal, fatura, boleto ou confirmação financeira.";
