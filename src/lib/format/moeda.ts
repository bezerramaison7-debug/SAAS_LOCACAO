import Decimal from "decimal.js";

/**
 * Dinheiro trafega como string decimal (ex.: "1234.56"), igual ao `numeric`
 * do PostgreSQL. Nunca usar `number` para valores monetários (RN-101).
 */
export type DecimalString = string;

const DECIMAL_RE = /^-?\d+(\.\d+)?$/;

const formatadorBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function paraDecimal(valor: DecimalString | Decimal): Decimal {
  if (valor instanceof Decimal) return valor;
  if (!DECIMAL_RE.test(valor)) throw new RangeError("Valor decimal inválido");
  return new Decimal(valor);
}

/**
 * Formata em pt-BR (`R$ 1.234,56`). O arredondamento (meio para cima, 2 casas)
 * acontece só na exibição; o valor armazenado não é alterado.
 */
export function formatarMoeda(valor: DecimalString | Decimal): string {
  const arredondado = paraDecimal(valor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
  // Intl aceita string decimal exata (sem passar por float).
  return formatadorBRL.format(arredondado as Intl.StringNumericLiteral);
}

/**
 * Converte texto digitado em pt-BR ("1.234,56", "R$ 10", "0,5") para string
 * decimal canônica com 2 casas. Retorna `null` se não for um valor válido.
 */
export function parseMoedaBR(texto: string): DecimalString | null {
  const limpo = texto.replace(/\s|R\$/g, "");
  if (!/^-?\d{1,3}(\.\d{3})*(,\d{1,2})?$|^-?\d+(,\d{1,2})?$/.test(limpo)) return null;
  const normalizado = limpo.replace(/\./g, "").replace(",", ".");
  return new Decimal(normalizado).toFixed(2);
}

export function somar(valores: readonly (DecimalString | Decimal)[]): Decimal {
  return valores.reduce<Decimal>((acc, v) => acc.plus(paraDecimal(v)), new Decimal(0));
}

const formatadorQuantidade = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });

/** Quantidades (`numeric(14,3)`) em pt-BR: "1.234,5". */
export function formatarQuantidade(valor: DecimalString | Decimal): string {
  return formatadorQuantidade.format(paraDecimal(valor).toFixed(3) as Intl.StringNumericLiteral);
}
