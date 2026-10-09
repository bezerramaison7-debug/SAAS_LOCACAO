import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import {
  formatarData,
  formatarDataCivil,
  formatarDataHora,
  hojeNoFuso,
  horarioLocalParaUtc,
  lancadoComAtraso,
  utcParaHorarioLocal,
} from "./datas";
import { formatarMoeda, formatarQuantidade, parseMoedaBR, valorEditavelBR, somar } from "./moeda";

// Normaliza o espaço não separável que o Intl usa entre "R$" e o número.
const nbsp = (s: string) => s.replace(/ /g, " ");

describe("datas", () => {
  it("exibe instante UTC no fuso de São Paulo em dd/MM/yyyy HH:mm", () => {
    expect(formatarDataHora("2026-03-01T02:30:00Z")).toBe("28/02/2026 23:30");
    expect(formatarData("2026-03-01T02:30:00Z")).toBe("28/02/2026");
  });

  it("respeita o fuso configurado pela empresa", () => {
    expect(formatarDataHora("2026-03-01T02:30:00Z", "America/Manaus")).toBe("28/02/2026 22:30");
    expect(formatarDataHora("2026-03-01T02:30:00Z", "UTC")).toBe("01/03/2026 02:30");
  });

  it("aplica horário de verão histórico (jan/2018 em São Paulo era UTC-2)", () => {
    expect(formatarDataHora("2018-01-15T12:00:00Z")).toBe("15/01/2018 10:00");
  });

  it("data civil não sofre conversão de fuso", () => {
    expect(formatarDataCivil("2026-12-31")).toBe("31/12/2026");
    expect(() => formatarDataCivil("31/12/2026")).toThrow(RangeError);
  });

  it("converte datetime-local da empresa para UTC e de volta", () => {
    const utc = horarioLocalParaUtc("2026-10-08T09:15");
    expect(utc).toBe("2026-10-08T12:15:00.000Z");
    expect(utcParaHorarioLocal(utc)).toBe("2026-10-08T09:15");
  });

  it("rejeita datas inexistentes, formatos e fusos inválidos", () => {
    expect(() => horarioLocalParaUtc("2026-02-30T10:00")).toThrow(RangeError);
    expect(() => horarioLocalParaUtc("08/10/2026 10:00")).toThrow(RangeError);
    expect(() => formatarDataHora("2026-01-01T00:00:00Z", "Lua/Base")).toThrow(RangeError);
    expect(() => formatarDataHora("não é data")).toThrow(RangeError);
  });

  it("hoje no fuso considera a virada de dia local", () => {
    expect(hojeNoFuso("America/Sao_Paulo", "2026-10-09T02:00:00Z")).toBe("2026-10-08");
    expect(hojeNoFuso("UTC", "2026-10-09T02:00:00Z")).toBe("2026-10-09");
  });

  it("identifica lançamento com atraso (RN-103)", () => {
    expect(lancadoComAtraso("2026-10-01T10:00:00Z", "2026-10-02T10:00:00Z", 24)).toBe(false);
    expect(lancadoComAtraso("2026-10-01T10:00:00Z", "2026-10-02T10:00:01Z", 24)).toBe(true);
  });
});

describe("moeda", () => {
  it("formata em pt-BR", () => {
    expect(nbsp(formatarMoeda("1234.56"))).toBe("R$ 1.234,56");
    expect(nbsp(formatarMoeda("0"))).toBe("R$ 0,00");
    expect(nbsp(formatarMoeda("-10.5"))).toBe("-R$ 10,50");
  });

  it("não perde precisão em valores grandes (além de 2^53)", () => {
    expect(nbsp(formatarMoeda("123456789012345.67"))).toBe("R$ 123.456.789.012.345,67");
  });

  it("arredonda apenas na exibição, meio para cima", () => {
    expect(nbsp(formatarMoeda("0.005"))).toBe("R$ 0,01");
    expect(nbsp(formatarMoeda("2.344"))).toBe("R$ 2,34");
  });

  it("soma sem erro de ponto flutuante", () => {
    expect(somar(["0.1", "0.2"]).toFixed(2)).toBe("0.30");
    expect(somar([new Decimal("1.10"), "2.20", "3.30"]).toFixed(2)).toBe("6.60");
  });

  it("interpreta valores digitados em pt-BR", () => {
    expect(parseMoedaBR("1.234,56")).toBe("1234.56");
    expect(parseMoedaBR("R$ 10")).toBe("10.00");
    expect(parseMoedaBR("0,5")).toBe("0.50");
    expect(parseMoedaBR("1234,5")).toBe("1234.50");
    expect(parseMoedaBR("12,345")).toBeNull();
    expect(parseMoedaBR("abc")).toBeNull();
    expect(parseMoedaBR("1.23,00")).toBeNull();
  });

  it("rejeita entrada que não seja string decimal", () => {
    expect(() => formatarMoeda("1e3")).toThrow(RangeError);
    expect(() => formatarMoeda("1,5")).toThrow(RangeError);
  });

  it("formata quantidades com até 3 casas", () => {
    expect(formatarQuantidade("1234.5")).toBe("1.234,5");
    expect(formatarQuantidade("10")).toBe("10");
  });
});

describe("valorEditavelBR", () => {
  it("formata para edição e volta pelo parse sem perda", () => {
    expect(valorEditavelBR("1234.5")).toBe("1.234,50");
    expect(parseMoedaBR(valorEditavelBR("999999999999.99"))).toBe("999999999999.99");
  });
});
