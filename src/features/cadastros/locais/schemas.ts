import { z } from "zod";

import { checkboxSchema, codigoSchema, textoOpcional } from "../comum";

export const TIPOS_LOCAL = ["OBRA", "ALMOXARIFADO", "ESCRITORIO", "OUTRO"] as const;
export type TipoLocal = (typeof TIPOS_LOCAL)[number];

export const ROTULO_TIPO_LOCAL: Record<TipoLocal, string> = {
  OBRA: "Obra",
  ALMOXARIFADO: "Almoxarifado",
  ESCRITORIO: "Escritório",
  OUTRO: "Outro",
};

const base = {
  nome: z.string().trim().min(2, "Informe o nome").max(200, "Máximo de 200 caracteres"),
  tipo: z.enum(TIPOS_LOCAL, "Selecione o tipo"),
  endereco: textoOpcional(500),
  ativo: checkboxSchema,
};

/** Criação: o código é definido uma única vez (identificador estável — não muda depois). */
export const novoLocalSchema = z.object({ codigo: codigoSchema, ...base });
export const edicaoLocalSchema = z.object(base);

export type DadosNovoLocal = z.infer<typeof novoLocalSchema>;

export const CAMPOS_LOCAL = ["codigo", "nome", "tipo", "endereco", "ativo"] as const;
