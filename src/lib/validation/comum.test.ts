import { describe, expect, it } from "vitest";

import {
  dataEventoSchema,
  dinheiroSchema,
  intervaloPaginacao,
  justificativaSchema,
  paginacaoSchema,
  quantidadeSchema,
  uuidSchema,
} from "./comum";

describe("paginação", () => {
  it("usa 25 por padrão e aceita apenas 25/50/100", () => {
    expect(paginacaoSchema.parse({})).toEqual({ pagina: 1, tamanho: 25 });
    expect(paginacaoSchema.parse({ pagina: "3", tamanho: "50" })).toEqual({
      pagina: 3,
      tamanho: 50,
    });
    expect(paginacaoSchema.parse({ pagina: "-1", tamanho: "1000" })).toEqual({
      pagina: 1,
      tamanho: 25,
    });
    expect(paginacaoSchema.parse({ pagina: "abc", tamanho: "100" }).tamanho).toBe(100);
  });

  it("calcula o intervalo inclusivo para o PostgREST", () => {
    expect(intervaloPaginacao({ pagina: 1, tamanho: 25 })).toEqual({ de: 0, ate: 24 });
    expect(intervaloPaginacao({ pagina: 3, tamanho: 50 })).toEqual({ de: 100, ate: 149 });
  });
});

describe("valores e quantidades", () => {
  it("dinheiro aceita string decimal com até 2 casas", () => {
    expect(dinheiroSchema.parse("1234.56")).toBe("1234.56");
    expect(dinheiroSchema.safeParse("1234.567").success).toBe(false);
    expect(dinheiroSchema.safeParse("-1").success).toBe(false);
    expect(dinheiroSchema.safeParse("1,50").success).toBe(false);
  });

  it("quantidade nunca é negativa", () => {
    expect(quantidadeSchema.parse("10.5")).toBe("10.5");
    expect(quantidadeSchema.safeParse("-3").success).toBe(false);
  });
});

describe("data do evento", () => {
  const agora = () => Date.parse("2026-10-08T12:00:00Z");

  it("aceita passado e até 5 minutos no futuro", () => {
    const schema = dataEventoSchema(agora);
    expect(schema.safeParse("2026-10-01T08:00:00-03:00").success).toBe(true);
    expect(schema.safeParse("2026-10-08T12:04:59Z").success).toBe(true);
  });

  it("rejeita futuro e formatos sem fuso", () => {
    const schema = dataEventoSchema(agora);
    expect(schema.safeParse("2026-10-08T12:06:00Z").success).toBe(false);
    expect(schema.safeParse("2026-10-08 10:00").success).toBe(false);
  });
});

describe("outros", () => {
  it("uuid e justificativa", () => {
    expect(uuidSchema.safeParse("3cd7a1e2-5b4f-4c3d-9a8b-1234567890ab").success).toBe(true);
    expect(uuidSchema.safeParse("123").success).toBe(false);
    expect(justificativaSchema.safeParse("curta").success).toBe(false);
    expect(justificativaSchema.safeParse("  motivo detalhado  ").success).toBe(true);
  });
});
