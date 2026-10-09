import Decimal from "decimal.js";
import { z } from "zod";

import { parseQuantidadeBR } from "@/features/locacoes/schemas";
import { dataFatoSchema } from "@/features/movimentacoes/schemas";
import { CONDICOES, type Condicao } from "@/features/recebimentos/rotulos";
import { horarioLocalParaUtc } from "@/lib/format/datas";

export type ItemSolicitado = { bem: string } | { lote: string; quantidade: string };

/**
 * Seleção do formulário de solicitação: `bem_{id}` marcado e `lote_{id}` com
 * quantidade (vazio = não devolver). Ids são revalidados pelo banco.
 */
export function lerSolicitacao(
  campos: Record<string, string>,
  disponivel: ReadonlyMap<string, string>,
): { itens: ItemSolicitado[]; erros: Record<string, string> } {
  const itens: ItemSolicitado[] = [];
  const erros: Record<string, string> = {};
  for (const [nome, valor] of Object.entries(campos)) {
    const bem = /^bem_([0-9a-f-]{36})$/.exec(nome);
    if (bem?.[1] && valor === "on") itens.push({ bem: bem[1] });
    const lote = /^lote_([0-9a-f-]{36})$/.exec(nome);
    if (lote?.[1] && valor.trim() !== "") {
      const q = parseQuantidadeBR(valor);
      const max = disponivel.get(lote[1]);
      if (q === null || new Decimal(q).lte(0))
        erros[nome] = "Informe uma quantidade maior que zero";
      else if (max !== undefined && new Decimal(q).gt(max))
        erros[nome] = "Acima do disponível para devolução";
      else itens.push({ lote: lote[1], quantidade: q });
    }
  }
  if (!itens.length && !Object.keys(erros).length)
    erros._ = "Selecione ao menos um bem ou informe a quantidade de um lote";
  return { itens, erros };
}

/** Data/hora local da empresa → UTC (agendamento pode ser futuro). */
export function agendamentoSchema(fuso: string) {
  return z.object({
    agendadaPara: z.string().transform((v, ctx) => {
      try {
        return horarioLocalParaUtc(v, fuso);
      } catch {
        ctx.addIssue({ code: "custom", message: "Informe data e hora válidas" });
        return z.NEVER;
      }
    }),
  });
}

export type ItemRetirada = { id: string; quantidade: string; condicao: Condicao | null };

/**
 * Retirada: data do fato (não futura), quem recebeu pelo fornecedor (RN-54) e,
 * por item, `qtd_{id}` (0..solicitada) e `cond_{id}` quando retirado.
 */
export function lerRetirada(
  campos: Record<string, string>,
  fuso: string,
  solicitadas: ReadonlyMap<string, string>,
  agora: () => number = Date.now,
): {
  dados: { retiradaEm: string; recebedor: string; itens: ItemRetirada[] } | null;
  erros: Record<string, string>;
} {
  const erros: Record<string, string> = {};
  const data = dataFatoSchema(fuso, agora).safeParse(campos.retiradaEm ?? "");
  if (!data.success) erros.retiradaEm = data.error.issues[0]?.message ?? "Data inválida";
  const recebedor = (campos.recebedor ?? "").trim();
  if (recebedor.length < 2) erros.recebedor = "Informe quem recebeu pelo fornecedor";
  else if (recebedor.length > 120) erros.recebedor = "Máximo de 120 caracteres";
  const itens: ItemRetirada[] = [];
  for (const [id, solicitada] of solicitadas) {
    const bruto = (campos[`qtd_${id}`] ?? "").trim();
    const q = bruto === "" ? null : parseQuantidadeBR(bruto);
    if (q === null) {
      erros[`qtd_${id}`] = "Informe a quantidade retirada (0 se não saiu)";
      continue;
    }
    if (new Decimal(q).gt(solicitada)) {
      erros[`qtd_${id}`] = "Maior que a quantidade solicitada";
      continue;
    }
    const cond = campos[`cond_${id}`] ?? "";
    const condicao = (CONDICOES as readonly string[]).includes(cond) ? (cond as Condicao) : null;
    if (new Decimal(q).gt(0) && !condicao) {
      erros[`cond_${id}`] = "Informe a condição de saída";
      continue;
    }
    itens.push({ id, quantidade: q, condicao });
  }
  if (
    !erros.retiradaEm &&
    !Object.keys(erros).length &&
    itens.every((i) => new Decimal(i.quantidade).isZero())
  )
    erros._ = "Nenhum item retirado: cancele a devolução em vez de confirmar";
  if (Object.keys(erros).length || !data.success) return { dados: null, erros };
  return { dados: { retiradaEm: data.data, recebedor, itens }, erros };
}
