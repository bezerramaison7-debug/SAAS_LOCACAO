import { describe, expect, it } from "vitest";

import { categoriaSchema } from "./schemas";

const valido = {
  nome: "Andaime",
  modoControle: "LOTE",
  checklistFamiliaId: "",
  exigeNumeroSerie: "",
  exigePlaca: "",
  exigeIdentFornecedor: "",
  exigeVistoriaSaida: "on",
  unidadePadrao: "pç",
  ativo: "on",
};

describe("categoriaSchema", () => {
  it("aceita lote sem identificação individual", () => {
    const r = categoriaSchema().parse(valido);
    expect(r).toMatchObject({
      modoControle: "LOTE",
      checklistFamiliaId: null,
      exigeVistoriaSaida: true,
      exigePlaca: false,
    });
  });

  it("rejeita exigência de placa em categoria de lote", () => {
    const r = categoriaSchema().safeParse({ ...valido, exigePlaca: "on" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["exigePlaca"]);
  });

  it("aceita identificação individual em categoria individual", () => {
    const r = categoriaSchema().parse({
      ...valido,
      modoControle: "INDIVIDUAL",
      exigeNumeroSerie: "on",
    });
    expect(r.exigeNumeroSerie).toBe(true);
  });

  it("na edição ignora o modo enviado e usa o existente", () => {
    const r = categoriaSchema("INDIVIDUAL").parse({
      ...valido,
      modoControle: "LOTE",
      exigePlaca: "on",
    });
    expect(r.modoControle).toBe("INDIVIDUAL");
  });

  it("rejeita família de checklist que não é UUID", () => {
    expect(categoriaSchema().safeParse({ ...valido, checklistFamiliaId: "x" }).success).toBe(false);
  });
});
