import { z } from "zod";

/** Estrutura do snapshot gerado por `relatorio_snapshot` (validada antes de renderizar). */
const texto = z
  .string()
  .nullable()
  .optional()
  .transform((v) => v ?? null);
const lista = <T extends z.ZodType>(item: T) =>
  z
    .array(item)
    .nullable()
    .optional()
    .transform((v) => v ?? []);

const fornecedor = z
  .object({ razao_social: z.string(), nome_fantasia: texto, documento: texto })
  .nullable()
  .optional()
  .transform((v) => v ?? null);

export const snapshotSchema = z.object({
  relatorio: z.object({
    id: z.string(),
    codigo: z.string(),
    tipo: z.enum(["LOCACAO", "BEM", "LOCAL", "PERIODO"]),
    versao_template: z.string(),
    solicitado_em: z.string(),
    solicitado_por: z.string(),
  }),
  empresa: z.object({ nome: z.string(), timezone: z.string() }),
  incluir_valores: z.boolean(),
  alvo: z
    .object({
      codigo: texto,
      nome: texto,
      tipo: texto,
      inicio: texto,
      fim: texto,
    })
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  locacao: z
    .object({
      codigo: z.string(),
      status: z.string(),
      status_financeiro: z.string(),
      fornecedor,
      centro_custo: texto,
      inicio_previsto: texto,
      termino_previsto: texto,
      inicio_efetivo: texto,
      ativada_em: texto,
      observacoes: texto,
      desmobilizacao_iniciada_em: texto,
      encerrada_operacional_em: texto,
      data_encerramento_financeiro: texto,
      referencias: lista(
        z.object({
          sistema: z.string(),
          tipo: z.string(),
          numero: z.string(),
          data_documento: texto,
        }),
      ),
      itens: lista(
        z.object({
          descricao: z.string(),
          modo: z.string(),
          unidade: z.string(),
          contratada: z.string(),
          periodicidade: z.string(),
          valor_unitario: texto,
          recebida: z.string(),
          devolvida: z.string(),
          saldo: z.string(),
        }),
      ),
      cobrancas: lista(
        z.object({
          codigo: z.string(),
          competencia_inicio: z.string(),
          competencia_fim: z.string(),
          valor: z.string(),
          documento: texto,
          status: z.string(),
        }),
      ),
    })
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  bens: lista(
    z.object({
      codigo: z.string(),
      item: z.string(),
      status: z.string(),
      numero_serie: texto,
      placa: texto,
      identificacao_fornecedor: texto,
      local: texto,
      responsavel: texto,
      substitui: texto,
    }),
  ),
  lotes: lista(
    z.object({
      codigo: z.string(),
      item: z.string(),
      unidade: z.string(),
      status: z.string(),
      recebida: z.string(),
      devolvida: z.string(),
      dividida: z.string(),
      baixada: z.string(),
      saldo: z.string(),
      local: texto,
      responsavel: texto,
      origem: texto,
    }),
  ),
  recebimentos: lista(
    z.object({
      codigo: z.string(),
      status: z.string(),
      data_evento: texto,
      local: texto,
      responsavel: texto,
      recebido_por: texto,
      linhas: lista(
        z.object({
          item: z.string(),
          alvo: z.string(),
          quantidade: z.string(),
          condicao: z.string(),
        }),
      ),
    }),
  ),
  vistorias: lista(
    z.object({
      tipo: z.string(),
      status: z.string(),
      data_evento: z.string(),
      alvo: texto,
      modelo: z.string(),
      versao: z.number(),
      realizada_por: texto,
      respostas: lista(z.object({ ordem: z.number(), pergunta: z.string(), resposta: texto })),
    }),
  ),
  movimentacoes: lista(
    z.object({
      codigo: z.string(),
      status: z.string(),
      data_evento: z.string(),
      alvo: texto,
      quantidade: texto,
      origem: texto,
      destino: texto,
      responsavel_anterior: texto,
      novo_responsavel: texto,
      motivo: texto,
      aceite_administrativo: z.boolean(),
    }),
  ),
  ocorrencias: lista(
    z.object({
      codigo: z.string(),
      tipo: z.string(),
      status: z.string(),
      prioridade: z.string(),
      data_evento: z.string(),
      prazo: texto,
      alvo: texto,
      descricao: z.string(),
      resultado: texto,
      resolucao: texto,
    }),
  ),
  devolucoes: lista(
    z.object({
      codigo: z.string(),
      status: z.string(),
      solicitada_em: texto,
      agendada_para: texto,
      retirada_em: texto,
      recebedor: texto,
      conferida_em: texto,
      ciencia_financeira_em: texto,
      motivo_cancelamento: texto,
      itens: lista(
        z.object({ alvo: texto, solicitada: z.string(), retirada: texto, condicao: texto }),
      ),
      comprovantes: lista(z.object({ nome: texto, hash: z.string(), enviada_em: z.string() })),
    }),
  ),
  evidencias: lista(
    z.object({
      id: z.string(),
      tipo: z.string(),
      bucket: z.string(),
      storage_path: z.string(),
      mime: z.string(),
      nome: texto,
      hash: z.string(),
      data: z.string(),
      enviada_em: z.string(),
      legenda: z.object({
        evento: texto,
        item: texto,
        local: texto,
        usuario: texto,
        texto: texto,
      }),
    }),
  ),
  evidencias_total: z.number(),
});

export type Snapshot = z.infer<typeof snapshotSchema>;
export type EvidenciaSnapshot = Snapshot["evidencias"][number];

/**
 * A fonte padrão do PDF (Helvetica, WinAnsi) não tem glifos fora do Latin-1 +
 * extensões do cp1252. Caracteres fora desse conjunto viram "?" em vez de
 * sumirem em silêncio; setas comuns ganham equivalente legível.
 */
const CP1252_EXTRAS = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
export function textoPdf(valor: string | null | undefined): string {
  if (!valor) return "";
  return [...valor.normalize("NFC").replace(/→/g, "->").replace(/[   ]/g, " ")]
    .map((c) => {
      const cp = c.codePointAt(0) ?? 0;
      if (c === "\n" || c === "\t") return c;
      if (cp < 0x20) return "";
      return cp <= 0xff || CP1252_EXTRAS.has(c) ? c : "?";
    })
    .join("");
}
