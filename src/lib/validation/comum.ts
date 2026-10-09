import { z } from "zod";

/** UUID (v1–v8) de entidades. */
export const uuidSchema = z.uuid({ message: "Identificador inválido" });

export const TAMANHOS_PAGINA = [25, 50, 100] as const;
export type TamanhoPagina = (typeof TAMANHOS_PAGINA)[number];
export const TAMANHO_PAGINA_PADRAO: TamanhoPagina = 25;

/**
 * Paginação vinda da URL (searchParams). Valores inválidos voltam ao padrão
 * em vez de gerar erro, para que links antigos ou editados à mão não quebrem a tela.
 */
export const paginacaoSchema = z.object({
  pagina: z.coerce.number().int().min(1).max(100_000).catch(1),
  tamanho: z.coerce
    .number()
    .refine((n): n is TamanhoPagina => (TAMANHOS_PAGINA as readonly number[]).includes(n))
    .catch(TAMANHO_PAGINA_PADRAO),
});
export type Paginacao = { pagina: number; tamanho: TamanhoPagina };

export function intervaloPaginacao({ pagina, tamanho }: Paginacao): { de: number; ate: number } {
  const de = (pagina - 1) * tamanho;
  return { de, ate: de + tamanho - 1 };
}

/** Valor monetário como string decimal, até 12 dígitos inteiros e 2 casas (numeric(14,2)). */
export const dinheiroSchema = z
  .string()
  .trim()
  .regex(/^\d{1,12}(\.\d{1,2})?$/, "Informe um valor válido (ex.: 1234.56)");

/** Quantidade não negativa com até 3 casas (numeric(14,3)). */
export const quantidadeSchema = z
  .string()
  .trim()
  .regex(/^\d{1,11}(\.\d{1,3})?$/, "Informe uma quantidade válida");

export const TOLERANCIA_FUTURO_MS = 5 * 60 * 1000;

/**
 * Data do fato (RN-102): instante ISO 8601 que não pode estar no futuro
 * (tolerância de 5 minutos para relógios de dispositivos).
 */
export function dataEventoSchema(agora: () => number = Date.now) {
  return z.iso
    .datetime({ offset: true, message: "Data e hora inválidas" })
    .refine((valor) => new Date(valor).getTime() <= agora() + TOLERANCIA_FUTURO_MS, {
      message: "A data do evento não pode estar no futuro",
    });
}

/** Texto livre obrigatório para justificativas/motivos de operações críticas. */
export const justificativaSchema = z
  .string()
  .trim()
  .min(10, "Descreva a justificativa com pelo menos 10 caracteres")
  .max(2000, "Máximo de 2000 caracteres");
