import { TZDate } from "@date-fns/tz";
import { format, isValid } from "date-fns";

/** Fuso padrão quando a empresa ainda não configurou o seu (RN-100). */
export const FUSO_PADRAO = "America/Sao_Paulo";

export type EntradaData = Date | string | number;

function paraDate(valor: EntradaData): Date {
  const data = valor instanceof Date ? valor : new Date(valor);
  if (!isValid(data)) throw new RangeError("Data inválida");
  return data;
}

export function fusoValido(fuso: string): boolean {
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: fuso });
    return true;
  } catch {
    return false;
  }
}

function noFuso(valor: EntradaData, fuso: string): TZDate {
  if (!fusoValido(fuso)) throw new RangeError(`Fuso horário inválido: ${fuso}`);
  return new TZDate(paraDate(valor).getTime(), fuso);
}

/** `dd/MM/yyyy HH:mm` no fuso da empresa. Entrada é um instante (UTC). */
export function formatarDataHora(valor: EntradaData, fuso: string = FUSO_PADRAO): string {
  return format(noFuso(valor, fuso), "dd/MM/yyyy HH:mm");
}

/** `dd/MM/yyyy` no fuso da empresa. */
export function formatarData(valor: EntradaData, fuso: string = FUSO_PADRAO): string {
  return format(noFuso(valor, fuso), "dd/MM/yyyy");
}

/**
 * Formata uma data civil (coluna `date`, ex.: `termino_previsto`), que não é
 * um instante e portanto não sofre conversão de fuso.
 */
export function formatarDataCivil(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) throw new RangeError("Data civil deve estar no formato yyyy-MM-dd");
  const [, ano, mes, dia] = match;
  return `${dia}/${mes}/${ano}`;
}

/**
 * Converte um valor de `<input type="datetime-local">` (horário de parede no
 * fuso da empresa) para um instante UTC em ISO 8601.
 */
export function horarioLocalParaUtc(valorLocal: string, fuso: string = FUSO_PADRAO): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(valorLocal);
  if (!match) throw new RangeError("Horário local deve estar no formato yyyy-MM-ddTHH:mm");
  if (!fusoValido(fuso)) throw new RangeError(`Fuso horário inválido: ${fuso}`);
  const [ano, mes, dia, hora, minuto, segundo] = match.slice(1).map((parte) => Number(parte ?? 0));
  if (
    ano === undefined ||
    mes === undefined ||
    dia === undefined ||
    hora === undefined ||
    minuto === undefined ||
    segundo === undefined
  ) {
    throw new RangeError("Horário local incompleto");
  }
  const data = new TZDate(ano, mes - 1, dia, hora, minuto, segundo, fuso);
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) {
    throw new RangeError("Data inexistente");
  }
  return new Date(data.getTime()).toISOString();
}

/** Inverso de `horarioLocalParaUtc`, para preencher `datetime-local`. */
export function utcParaHorarioLocal(valor: EntradaData, fuso: string = FUSO_PADRAO): string {
  return format(noFuso(valor, fuso), "yyyy-MM-dd'T'HH:mm");
}

/** Data civil "hoje" no fuso da empresa (yyyy-MM-dd), para regras como "términos em 7 dias". */
export function hojeNoFuso(fuso: string = FUSO_PADRAO, agora: EntradaData = Date.now()): string {
  return format(noFuso(agora, fuso), "yyyy-MM-dd");
}

/** RN-103: lançamento com atraso quando o registro ocorreu muito depois do fato. */
export function lancadoComAtraso(
  dataEvento: EntradaData,
  criadoEm: EntradaData,
  limiteHoras: number,
): boolean {
  const diferencaMs = paraDate(criadoEm).getTime() - paraDate(dataEvento).getTime();
  return diferencaMs > limiteHoras * 60 * 60 * 1000;
}
