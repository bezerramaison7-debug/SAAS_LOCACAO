import { z } from "zod";

import { emailSchema } from "@/features/auth/schemas";
import { PAPEIS } from "@/lib/permissions/matriz";
import { justificativaSchema } from "@/lib/validation/comum";

export const papelSchema = z.enum(PAPEIS, { message: "Selecione um papel válido" });

export const convidarUsuarioSchema = z.object({
  email: emailSchema,
  nome: z.string().trim().min(2, "Informe o nome").max(200, "Nome muito longo"),
  papel: papelSchema,
});

export const alterarPapelSchema = z.object({
  associacaoId: z.uuid({ message: "Usuário inválido" }),
  papel: papelSchema,
});

export const definirAtivoSchema = z.object({
  associacaoId: z.uuid({ message: "Usuário inválido" }),
  ativo: z.enum(["true", "false"]).transform((v) => v === "true"),
  motivo: justificativaSchema,
});
