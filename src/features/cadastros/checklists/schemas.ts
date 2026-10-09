import { z } from "zod";

import { textoOpcional } from "../comum";

export const TIPOS_RESPOSTA = [
  "SIM_NAO",
  "CONFORME_NAO_CONFORME",
  "OPCAO_UNICA",
  "TEXTO",
  "NUMERO",
] as const;
export type TipoResposta = (typeof TIPOS_RESPOSTA)[number];

export const ROTULO_TIPO_RESPOSTA: Record<TipoResposta, string> = {
  SIM_NAO: "Sim / Não",
  CONFORME_NAO_CONFORME: "Conforme / Não conforme",
  OPCAO_UNICA: "Opção única (lista)",
  TEXTO: "Texto livre",
  NUMERO: "Número",
};

/** Respostas possíveis dos tipos fechados (valor gravado na vistoria, rótulo). */
export const RESPOSTAS_FIXAS: Partial<
  Record<TipoResposta, readonly (readonly [string, string])[]>
> = {
  SIM_NAO: [
    ["SIM", "Sim"],
    ["NAO", "Não"],
  ],
  CONFORME_NAO_CONFORME: [
    ["CONFORME", "Conforme"],
    ["NAO_CONFORME", "Não conforme"],
  ],
};

export const MODOS_FOTO = ["NUNCA", "SEMPRE", "RESPOSTAS"] as const;
export type ModoFoto = (typeof MODOS_FOTO)[number];

export const ROTULO_MODO_FOTO: Record<ModoFoto, string> = {
  NUNCA: "Nunca",
  SEMPRE: "Sempre",
  RESPOSTAS: "Somente para respostas específicas",
};

export type ExigeFoto =
  { modo: "NUNCA" } | { modo: "SEMPRE" } | { modo: "RESPOSTAS"; respostas: string[] };

export const STATUS_CHECKLIST = ["RASCUNHO", "PUBLICADO", "ARQUIVADO"] as const;
export type StatusChecklist = (typeof STATUS_CHECKLIST)[number];

export const ROTULO_STATUS_CHECKLIST: Record<StatusChecklist, string> = {
  RASCUNHO: "Rascunho",
  PUBLICADO: "Publicado (vigente)",
  ARQUIVADO: "Arquivado",
};

export const modeloChecklistSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome").max(200, "Máximo de 200 caracteres"),
  descricao: textoOpcional(2000),
});

export const CAMPOS_MODELO = ["nome", "descricao"] as const;

/** Uma opção por linha; vazias ignoradas. */
export function linhas(texto: string): string[] {
  return texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Respostas válidas para o tipo (null = tipo aberto, sem respostas enumeráveis). */
export function respostasValidas(tipo: TipoResposta, opcoes: string[] | null): string[] | null {
  if (tipo === "OPCAO_UNICA") return opcoes ?? [];
  return RESPOSTAS_FIXAS[tipo]?.map(([v]) => v) ?? null;
}

export const perguntaSchema = z
  .object({
    ordem: z.coerce
      .number("Informe a ordem")
      .int("Use um número inteiro")
      .min(1, "Mínimo 1")
      .max(500, "Máximo 500"),
    texto: z
      .string()
      .trim()
      .min(3, "Informe a pergunta (mín. 3 caracteres)")
      .max(500, "Máximo de 500 caracteres"),
    tipoResposta: z.enum(TIPOS_RESPOSTA, "Selecione o tipo de resposta"),
    opcoes: z.string().max(5000),
    obrigatoria: z
      .enum(["on", ""])
      .optional()
      .transform((v) => v === "on"),
    fotoModo: z.enum(MODOS_FOTO, "Selecione quando exigir foto"),
    fotoRespostas: z.array(z.string().trim().max(100)),
  })
  .transform((d, ctx) => {
    const opcoes = d.tipoResposta === "OPCAO_UNICA" ? linhas(d.opcoes) : null;
    if (opcoes) {
      if (opcoes.length < 2)
        ctx.addIssue({
          code: "custom",
          path: ["opcoes"],
          message: "Informe ao menos 2 opções (uma por linha)",
        });
      if (new Set(opcoes).size !== opcoes.length)
        ctx.addIssue({ code: "custom", path: ["opcoes"], message: "Há opções repetidas" });
      if (opcoes.some((o) => o.length > 100))
        ctx.addIssue({
          code: "custom",
          path: ["opcoes"],
          message: "Cada opção pode ter até 100 caracteres",
        });
    }
    let exigeFoto: ExigeFoto = { modo: d.fotoModo === "SEMPRE" ? "SEMPRE" : "NUNCA" };
    if (d.fotoModo === "RESPOSTAS") {
      const validas = respostasValidas(d.tipoResposta, opcoes);
      const escolhidas = [...new Set(d.fotoRespostas.filter(Boolean))];
      if (validas === null) {
        ctx.addIssue({
          code: "custom",
          path: ["fotoModo"],
          message: "Para texto ou número, escolha Nunca ou Sempre",
        });
      } else if (escolhidas.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["fotoRespostas"],
          message: "Marque ao menos uma resposta que exige foto",
        });
      } else if (escolhidas.some((r) => !validas.includes(r))) {
        ctx.addIssue({
          code: "custom",
          path: ["fotoRespostas"],
          message: "Resposta que exige foto não existe nas opções",
        });
      }
      exigeFoto = { modo: "RESPOSTAS", respostas: escolhidas };
    }
    return {
      ordem: d.ordem,
      texto: d.texto,
      tipoResposta: d.tipoResposta,
      opcoes,
      obrigatoria: d.obrigatoria,
      exigeFoto,
    };
  });

export type DadosPergunta = z.output<typeof perguntaSchema>;

export const CAMPOS_PERGUNTA = [
  "ordem",
  "texto",
  "tipoResposta",
  "opcoes",
  "obrigatoria",
  "fotoModo",
] as const;

/** Descrição curta da regra de foto. */
export function descreverExigeFoto(exige: ExigeFoto, tipo: TipoResposta): string {
  if (exige.modo === "NUNCA") return "Foto: não exigida";
  if (exige.modo === "SEMPRE") return "Foto: sempre";
  const rotulos = new Map(RESPOSTAS_FIXAS[tipo] ?? []);
  return `Foto quando: ${exige.respostas.map((r) => rotulos.get(r) ?? r).join(", ")}`;
}
