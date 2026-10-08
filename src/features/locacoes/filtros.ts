import { z } from "zod";

import { type ParametrosBusca } from "@/components/tables/url";
import { paginacaoSchema, uuidSchema, type Paginacao } from "@/lib/validation/comum";

import { maquinaLocacao, type StatusLocacao } from "./rules/maquina-estado";

export const PRAZOS_TERMINO = [7, 15, 30] as const;
export type PrazoTermino = (typeof PRAZOS_TERMINO)[number];

export type FiltrosLocacao = {
  q: string;
  status: StatusLocacao[];
  fornecedor: string | null;
  centro: string | null;
  local: string | null;
  de: string | null;
  ate: string | null;
  termino: PrazoTermino | null;
  paginacao: Paginacao;
};

const dataSchema = z.iso.date().nullable().catch(null);
const idSchema = uuidSchema.nullable().catch(null);

function primeiro(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

/** Aceita `status=A&status=B` (formulário) e `status=A,B` (link compartilhado). */
function lerStatus(valor: string | string[] | undefined): StatusLocacao[] {
  const brutos = (Array.isArray(valor) ? valor : valor ? [valor] : []).flatMap((v) => v.split(","));
  const validos = maquinaLocacao.estados as readonly string[];
  return [
    ...new Set(brutos.map((s) => s.trim()).filter((s): s is StatusLocacao => validos.includes(s))),
  ];
}

/** Filtros da listagem a partir da URL. Valores inválidos são ignorados (link antigo não quebra a tela). */
export function lerFiltrosLocacao(params: ParametrosBusca): FiltrosLocacao {
  const termino = Number(primeiro(params.termino));
  let de = dataSchema.parse(primeiro(params.de) ?? null);
  let ate = dataSchema.parse(primeiro(params.ate) ?? null);
  if (de && ate && de > ate) [de, ate] = [ate, de];
  return {
    q: z
      .string()
      .trim()
      .max(100)
      .catch("")
      .parse(primeiro(params.q) ?? ""),
    status: lerStatus(params.status),
    fornecedor: idSchema.parse(primeiro(params.fornecedor) ?? null),
    centro: idSchema.parse(primeiro(params.centro) ?? null),
    local: idSchema.parse(primeiro(params.local) ?? null),
    de,
    ate,
    termino: (PRAZOS_TERMINO as readonly number[]).includes(termino)
      ? (termino as PrazoTermino)
      : null,
    paginacao: paginacaoSchema.parse({
      pagina: primeiro(params.pagina),
      tamanho: primeiro(params.tamanho),
    }),
  };
}

/** Soma dias a uma data civil (YYYY-MM-DD) sem passar por fuso. */
export function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Escapa curingas do ILIKE para que o termo seja buscado literalmente. */
export function termoLiteral(q: string): string {
  return q.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function temFiltroAtivo(f: FiltrosLocacao): boolean {
  return Boolean(
    f.q || f.status.length || f.fornecedor || f.centro || f.local || f.de || f.ate || f.termino,
  );
}
