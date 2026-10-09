import { describe, expect, it } from "vitest";

import { movimentacaoSchema } from "./schemas";

const ID = "a3000000-0000-4000-8000-000000000002";
const AGORA = Date.parse("2026-10-09T15:00:00Z");
const schema = movimentacaoSchema("America/Sao_Paulo", () => AGORA);
const base = {
  destinoLocalId: ID,
  novoResponsavelId: ID,
  dataEvento: "2026-10-09T10:00",
  motivo: "Frente de serviço",
  quantidade: "",
  correcao: "",
};

describe("movimentacaoSchema", () => {
  it("converte data local e quantidade pt-BR", () => {
    expect(schema.parse({ ...base, quantidade: "12,5" })).toEqual({
      ...base,
      dataEvento: "2026-10-09T13:00:00.000Z",
      quantidade: "12.5",
      correcao: false,
    });
  });
  it("quantidade vazia (bem ou lote inteiro) vira null", () => {
    expect(schema.parse(base).quantidade).toBeNull();
  });
  it("rejeita futuro, seleção vazia e quantidade zero", () => {
    const r = schema.safeParse({ ...base, destinoLocalId: "", dataEvento: "2026-10-09T13:00" });
    expect(r.success).toBe(false);
    expect(schema.safeParse({ ...base, quantidade: "0" }).success).toBe(false);
  });
  it("correção exige motivo detalhado", () => {
    expect(schema.safeParse({ ...base, correcao: "on", motivo: "Erro" }).success).toBe(false);
    expect(
      schema.safeParse({ ...base, correcao: "on", motivo: "Destino lançado errado" }).success,
    ).toBe(true);
  });
});
