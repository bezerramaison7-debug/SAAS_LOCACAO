import { z } from "zod";

import { checkboxSchema, textoOpcional } from "../comum";

export const fornecedorSchema = z.object({
  razaoSocial: z
    .string()
    .trim()
    .min(2, "Informe a razão social")
    .max(200, "Máximo de 200 caracteres"),
  nomeFantasia: textoOpcional(200),
  documento: z
    .string()
    .trim()
    .max(30, "Documento muito longo")
    .refine(
      (v) => v === "" || /^[0-9./\-\s]{5,30}$/.test(v),
      "Use apenas números, ponto, barra e hífen",
    )
    .transform((v) => (v === "" ? null : v)),
  contatoNome: textoOpcional(120),
  contatoEmail: z
    .string()
    .trim()
    .max(254)
    .refine((v) => v === "" || z.email().safeParse(v).success, "E-mail inválido")
    .transform((v) => (v === "" ? null : v.toLowerCase())),
  contatoTelefone: textoOpcional(30),
  observacoes: textoOpcional(2000),
  ativo: checkboxSchema,
});

export type DadosFornecedor = z.infer<typeof fornecedorSchema>;

export const CAMPOS_FORNECEDOR = [
  "razaoSocial",
  "nomeFantasia",
  "documento",
  "contatoNome",
  "contatoEmail",
  "contatoTelefone",
  "observacoes",
  "ativo",
] as const;
