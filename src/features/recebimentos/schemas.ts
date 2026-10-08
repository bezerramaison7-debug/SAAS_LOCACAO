import Decimal from "decimal.js";
import { z } from "zod";

import { parseQuantidadeBR } from "@/features/locacoes/schemas";
import { horarioLocalParaUtc } from "@/lib/format/datas";
import { TOLERANCIA_FUTURO_MS, uuidSchema } from "@/lib/validation/comum";

import { CONDICOES } from "./rotulos";

function textoOpcional(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .transform((v) => (v === "" ? null : v));
}

/** Local/responsável/data do fato. A data chega no horário de parede da empresa. */
export function destinoSchema(fuso: string, agora: () => number = Date.now) {
  return z.object({
    dataEvento: z.string().transform((v, ctx) => {
      let iso: string;
      try {
        iso = horarioLocalParaUtc(v, fuso);
      } catch {
        ctx.addIssue({ code: "custom", message: "Informe data e hora válidas" });
        return z.NEVER;
      }
      if (new Date(iso).getTime() > agora() + TOLERANCIA_FUTURO_MS) {
        ctx.addIssue({ code: "custom", message: "A data do recebimento não pode estar no futuro" });
        return z.NEVER;
      }
      return iso;
    }),
    localId: uuidSchema.or(z.literal("")).refine((v) => v !== "", "Selecione o local"),
    responsavelId: uuidSchema.or(z.literal("")).refine((v) => v !== "", "Selecione o responsável"),
    observacoes: textoOpcional(4000),
  });
}
export const CAMPOS_DESTINO = ["dataEvento", "localId", "responsavelId", "observacoes"] as const;

export type Exigencias = { numeroSerie: boolean; placa: boolean; identificacaoFornecedor: boolean };

/** Bem individual: identificação exigida pela categoria (RN-23). */
export function bemSchema(exige: Exigencias) {
  const ident = (max: number, obrigatorio: boolean, rotulo: string) =>
    z
      .string()
      .trim()
      .max(max, `Máximo de ${max} caracteres`)
      .refine((v) => !obrigatorio || v !== "", `Informe ${rotulo}`)
      .transform((v) => (v === "" ? null : v));
  return z.object({
    numeroSerie: ident(80, exige.numeroSerie, "o número de série"),
    placa: ident(20, exige.placa, "a placa"),
    identificacaoFornecedor: ident(
      80,
      exige.identificacaoFornecedor,
      "a identificação do fornecedor",
    ),
    condicao: z.enum(CONDICOES, "Selecione a condição"),
    observacao: textoOpcional(1000),
  });
}
export const CAMPOS_BEM = [
  "numeroSerie",
  "placa",
  "identificacaoFornecedor",
  "condicao",
  "observacao",
] as const;

export const loteSchema = z.object({
  quantidade: z.string().transform((v, ctx) => {
    const q = parseQuantidadeBR(v);
    if (q === null || new Decimal(q).lte(0)) {
      ctx.addIssue({ code: "custom", message: "Informe a quantidade recebida (ex.: 30 ou 12,5)" });
      return z.NEVER;
    }
    return q;
  }),
  condicao: z.enum(CONDICOES, "Selecione a condição"),
  observacao: textoOpcional(1000),
});
export const CAMPOS_LOTE = ["quantidade", "condicao", "observacao"] as const;

export type PerguntaParaResposta = {
  id: string;
  tipoResposta: "SIM_NAO" | "CONFORME_NAO_CONFORME" | "OPCAO_UNICA" | "TEXTO" | "NUMERO";
  opcoes: string[] | null;
};

/**
 * Converte os campos `resposta_{perguntaId}` em JSON por tipo. Vazio = sem
 * resposta (a obrigatoriedade é verificada na confirmação — RN-83).
 */
export function lerRespostas(
  perguntas: PerguntaParaResposta[],
  campos: Record<string, string>,
): { respostas: Map<string, string | number>; erros: Record<string, string> } {
  const respostas = new Map<string, string | number>();
  const erros: Record<string, string> = {};
  for (const p of perguntas) {
    const bruto = (campos[`resposta_${p.id}`] ?? "").trim();
    if (bruto === "") continue;
    const nome = `resposta_${p.id}`;
    switch (p.tipoResposta) {
      case "NUMERO": {
        // pt-BR: com vírgula, pontos são milhar ("1.234,5"); sem vírgula, ponto é decimal.
        const normalizado = bruto.includes(",")
          ? bruto.replace(/\./g, "").replace(",", ".")
          : bruto;
        const n = Number(normalizado);
        if (!Number.isFinite(n)) erros[nome] = "Informe um número";
        else respostas.set(p.id, n);
        break;
      }
      case "SIM_NAO":
        if (bruto !== "SIM" && bruto !== "NAO") erros[nome] = "Escolha Sim ou Não";
        else respostas.set(p.id, bruto);
        break;
      case "CONFORME_NAO_CONFORME":
        if (bruto !== "CONFORME" && bruto !== "NAO_CONFORME") erros[nome] = "Escolha uma opção";
        else respostas.set(p.id, bruto);
        break;
      case "OPCAO_UNICA":
        if (!p.opcoes?.includes(bruto)) erros[nome] = "Escolha uma das opções";
        else respostas.set(p.id, bruto);
        break;
      case "TEXTO":
        if (bruto.length > 1000) erros[nome] = "Máximo de 1000 caracteres";
        else respostas.set(p.id, bruto);
        break;
    }
  }
  return { respostas, erros };
}
