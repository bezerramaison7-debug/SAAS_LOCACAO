import { describe, expect, it } from "vitest";

import { cobrancaSchema } from "./schemas";

const base = {
  competenciaInicio: "2026-09-01",
  competenciaFim: "2026-09-30",
  valor: "5.672,00",
  numeroDocumento: " NF-1 ",
  observacoes: "",
};

describe("cobrancaSchema", () => {
  it("normaliza valor pt-BR e campos opcionais", () => {
    expect(cobrancaSchema.parse(base)).toEqual({
      competenciaInicio: "2026-09-01",
      competenciaFim: "2026-09-30",
      valor: "5672.00",
      numeroDocumento: "NF-1",
      observacoes: null,
    });
  });

  it("recusa competência invertida e valor inválido", () => {
    const r = cobrancaSchema.safeParse({ ...base, competenciaFim: "2026-08-31", valor: "abc" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const caminhos = r.error.issues.map((i) => i.path.join("."));
      expect(caminhos).toContain("valor");
    }
    const invertida = cobrancaSchema.safeParse({ ...base, competenciaFim: "2026-08-31" });
    expect(invertida.success).toBe(false);
    if (!invertida.success) expect(invertida.error.issues[0]?.path).toEqual(["competenciaFim"]);
  });
});
