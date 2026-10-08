import { z } from "zod";

/** Fusos do Brasil oferecidos na configuração da empresa (RN-100). */
export const FUSOS_BRASIL = [
  "America/Sao_Paulo",
  "America/Bahia",
  "America/Fortaleza",
  "America/Recife",
  "America/Maceio",
  "America/Belem",
  "America/Araguaina",
  "America/Santarem",
  "America/Manaus",
  "America/Cuiaba",
  "America/Campo_Grande",
  "America/Porto_Velho",
  "America/Boa_Vista",
  "America/Rio_Branco",
  "America/Eirunepe",
  "America/Noronha",
] as const;

export const perfilSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome").max(200, "Nome muito longo"),
  telefone: z
    .string()
    .trim()
    .max(30, "Telefone muito longo")
    .refine((v) => v === "" || /^[0-9()+\-\s]{8,30}$/.test(v), "Telefone inválido")
    .transform((v) => (v === "" ? null : v)),
});

export const empresaSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome").max(200, "Nome muito longo"),
  timezone: z.enum(FUSOS_BRASIL, { message: "Selecione um fuso válido" }),
  exigeAceite: z
    .enum(["on", ""])
    .optional()
    .transform((v) => v === "on"),
  limiteAtrasoHoras: z.coerce
    .number({ message: "Informe um número" })
    .int("Informe horas inteiras")
    .min(1, "Mínimo 1 hora")
    .max(720, "Máximo 720 horas"),
});
