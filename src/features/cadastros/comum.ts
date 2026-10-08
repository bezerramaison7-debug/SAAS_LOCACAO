import { z } from "zod";

import { type ParametrosBusca } from "@/components/tables/url";
import { paginacaoSchema, type Paginacao } from "@/lib/validation/comum";

export const SITUACOES = ["ativos", "inativos", "todos"] as const;
export type Situacao = (typeof SITUACOES)[number];

const filtrosSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  situacao: z.enum(SITUACOES).catch("ativos"),
});

export type FiltrosCadastro = { q: string; situacao: Situacao; paginacao: Paginacao };

function primeiro(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

/** Filtros de listagem a partir da URL (valores inválidos voltam ao padrão). */
export function lerFiltrosCadastro(params: ParametrosBusca): FiltrosCadastro {
  const { q, situacao } = filtrosSchema.parse({
    q: primeiro(params.q) ?? "",
    situacao: primeiro(params.situacao),
  });
  const paginacao = paginacaoSchema.parse({
    pagina: primeiro(params.pagina),
    tamanho: primeiro(params.tamanho),
  });
  return { q, situacao, paginacao };
}

/** Campo booleano de formulário (checkbox HTML envia "on" ou nada). */
export const checkboxSchema = z
  .enum(["on", ""])
  .optional()
  .transform((v) => v === "on");

/** Texto opcional: string vazia vira null. */
export function textoOpcional(max: number, mensagem = "Texto muito longo") {
  return z
    .string()
    .trim()
    .max(max, mensagem)
    .transform((v) => (v === "" ? null : v));
}

/** Código informado pelo usuário (locais, centros de custo) — mesmo padrão do banco. */
export const codigoSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9._/-]{0,39}$/, "Use letras, números, ponto, hífen, barra (até 40)");
