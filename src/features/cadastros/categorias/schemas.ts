import { z } from "zod";

import { uuidSchema } from "@/lib/validation/comum";

import { checkboxSchema } from "../comum";

export const MODOS_CONTROLE = ["INDIVIDUAL", "LOTE"] as const;
export type ModoControle = (typeof MODOS_CONTROLE)[number];

export const ROTULO_MODO_CONTROLE: Record<ModoControle, string> = {
  INDIVIDUAL: "Individual (cada bem identificado)",
  LOTE: "Lote (controle por quantidade)",
};

const EXIGENCIAS_INDIVIDUAIS = ["exigeNumeroSerie", "exigePlaca", "exigeIdentFornecedor"] as const;

const base = z.object({
  nome: z.string().trim().min(2, "Informe o nome").max(120, "Máximo de 120 caracteres"),
  checklistFamiliaId: z.union([z.literal(""), uuidSchema]).transform((v) => (v === "" ? null : v)),
  exigeNumeroSerie: checkboxSchema,
  exigePlaca: checkboxSchema,
  exigeIdentFornecedor: checkboxSchema,
  exigeVistoriaSaida: checkboxSchema,
  unidadePadrao: z.string().trim().min(1, "Informe a unidade").max(20, "Máximo de 20 caracteres"),
  ativo: checkboxSchema,
});

/**
 * O modo de controle é definido na criação e não muda (RN-11: é herdado e
 * congelado pelos itens). Identificação individual só vale para INDIVIDUAL.
 */
export function categoriaSchema(modoExistente?: ModoControle) {
  return base
    .extend({
      modoControle: modoExistente
        ? z.literal(modoExistente).catch(modoExistente)
        : z.enum(MODOS_CONTROLE, "Selecione o modo de controle"),
    })
    .superRefine((d, ctx) => {
      if (d.modoControle !== "LOTE") return;
      for (const campo of EXIGENCIAS_INDIVIDUAIS) {
        if (d[campo]) {
          ctx.addIssue({
            code: "custom",
            path: [campo],
            message: "Disponível apenas para controle individual",
          });
        }
      }
    });
}

export type DadosCategoria = z.infer<ReturnType<typeof categoriaSchema>>;

export const CAMPOS_CATEGORIA = [
  "nome",
  "modoControle",
  "checklistFamiliaId",
  "exigeNumeroSerie",
  "exigePlaca",
  "exigeIdentFornecedor",
  "exigeVistoriaSaida",
  "unidadePadrao",
  "ativo",
] as const;
