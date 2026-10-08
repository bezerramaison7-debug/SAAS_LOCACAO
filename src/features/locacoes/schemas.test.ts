import { describe, expect, it } from "vitest";

import {
  identificacaoSchema,
  itemSchema,
  lerAba,
  lerEtapa,
  parseQuantidadeBR,
  referenciaSchema,
  vigenciaSchema,
} from "./schemas";

const CAT = "a6000000-0000-4000-8000-000000000001";
const item = {
  categoriaId: CAT,
  descricao: "Estação total Leica",
  quantidade: "2",
  unidade: "un",
  valorUnitario: "1.234,56",
  periodicidade: "MENSAL",
  observacao: "",
};

describe("parseQuantidadeBR", () => {
  it.each([
    ["10", "10"],
    ["2,5", "2.5"],
    ["1.234,125", "1234.125"],
    ["0,001", "0.001"],
  ])("%s → %s", (entrada, saida) => expect(parseQuantidadeBR(entrada)).toBe(saida));
  it.each(["", "1,2345", "abc", "-1", "1.2.3"])("rejeita %j", (e) =>
    expect(parseQuantidadeBR(e)).toBeNull(),
  );
});

describe("itemSchema", () => {
  it("normaliza valor e quantidade", () => {
    expect(itemSchema("INDIVIDUAL").parse(item)).toMatchObject({
      quantidade: "2",
      valorUnitario: "1234.56",
      observacao: null,
    });
  });
  it("controle individual exige quantidade inteira; lote aceita fração", () => {
    expect(itemSchema("INDIVIDUAL").safeParse({ ...item, quantidade: "1,5" }).success).toBe(false);
    expect(itemSchema("LOTE").parse({ ...item, quantidade: "1,5" }).quantidade).toBe("1.5");
  });
  it("rejeita quantidade zero e valor inválido", () => {
    expect(itemSchema("LOTE").safeParse({ ...item, quantidade: "0" }).success).toBe(false);
    expect(itemSchema("LOTE").safeParse({ ...item, valorUnitario: "12,345" }).success).toBe(false);
    expect(itemSchema("LOTE").safeParse({ ...item, valorUnitario: "-1" }).success).toBe(false);
  });
  it("aceita valor zero (cortesia)", () => {
    expect(itemSchema("LOTE").parse({ ...item, valorUnitario: "0" }).valorUnitario).toBe("0.00");
  });
});

describe("demais etapas", () => {
  it("identificação exige fornecedor e centro de custo", () => {
    const r = identificacaoSchema.safeParse({
      fornecedorId: "",
      centroCustoId: "",
      observacoes: "",
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path[0])).toEqual(["fornecedorId", "centroCustoId"]);
  });
  it("referência com data opcional", () => {
    const r = referenciaSchema.parse({
      sistema: "SECTRA",
      tipo: "PEDIDO",
      numero: " PC-1 ",
      dataDocumento: "",
      observacao: "",
    });
    expect(r).toEqual({
      sistema: "SECTRA",
      tipo: "PEDIDO",
      numero: "PC-1",
      dataDocumento: null,
      observacao: null,
    });
  });
  it("vigência: término não antes do início", () => {
    expect(
      vigenciaSchema.safeParse({ inicioPrevisto: "2026-10-10", terminoPrevisto: "2026-10-09" })
        .success,
    ).toBe(false);
    expect(
      vigenciaSchema.safeParse({ inicioPrevisto: "2026-10-10", terminoPrevisto: "2026-10-10" })
        .success,
    ).toBe(true);
  });
  it("etapa e aba inválidas voltam ao padrão", () => {
    expect(lerEtapa("xpto")).toBe("identificacao");
    expect(lerEtapa("itens")).toBe("itens");
    expect(lerAba(undefined)).toBe("resumo");
    expect(lerAba(["historico"])).toBe("historico");
  });
});
