import { z } from "zod";

import { checkboxSchema, codigoSchema } from "../comum";

const base = {
  nome: z.string().trim().min(2, "Informe o nome").max(200, "Máximo de 200 caracteres"),
  ativo: checkboxSchema,
};

/** Criação: o código é definido uma única vez (identificador estável). */
export const novoCentroCustoSchema = z.object({ codigo: codigoSchema, ...base });
export const edicaoCentroCustoSchema = z.object(base);

export const CAMPOS_CENTRO_CUSTO = ["codigo", "nome", "ativo"] as const;
