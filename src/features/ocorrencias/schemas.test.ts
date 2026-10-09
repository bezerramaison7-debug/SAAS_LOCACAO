import { describe, expect, it } from "vitest";

import { resultadosPara, vencida } from "./rotulos";
import { ocorrenciaSchema, resolucaoSchema } from "./schemas";

const AGORA = Date.parse("2026-10-09T15:00:00Z");
const schema = ocorrenciaSchema("America/Sao_Paulo", () => AGORA);
const base = {
  tipo: "DEFEITO",
  descricao: "Não liga após a chuva",
  prioridade: "ALTA",
  dataEvento: "2026-10-09T09:00",
  prazo: "",
  quantidade: "",
  manutencao: "on",
};

describe("ocorrências", () => {
  it("normaliza datas e quantidade", () => {
    const r = schema.parse({ ...base, prazo: "2026-10-12T18:00", quantidade: "2,5" });
    expect(r).toMatchObject({
      dataEvento: "2026-10-09T12:00:00.000Z",
      prazo: "2026-10-12T21:00:00.000Z",
      quantidade: "2.5",
      manutencao: true,
    });
  });
  it("troca não é registrável manualmente; manutenção só para defeito/avaria", () => {
    expect(schema.safeParse({ ...base, tipo: "TROCA" }).success).toBe(false);
    expect(schema.safeParse({ ...base, tipo: "EXTRAVIO" }).success).toBe(false);
    expect(schema.safeParse({ ...base, tipo: "EXTRAVIO", manutencao: "" }).success).toBe(true);
  });
  it("descrição curta e data futura são recusadas", () => {
    expect(schema.safeParse({ ...base, descricao: "curta" }).success).toBe(false);
    expect(schema.safeParse({ ...base, dataEvento: "2026-10-09T13:00" }).success).toBe(false);
  });
  it("resolução exige texto e resultado", () => {
    expect(resolucaoSchema.safeParse({ resultado: "REPARADO", resolucao: "ok" }).success).toBe(
      false,
    );
    expect(
      resolucaoSchema.safeParse({ resultado: "SUBSTITUIDO", resolucao: "Trocado pelo fornecedor" })
        .success,
    ).toBe(false);
  });
  it("vencida e resultados por tipo", () => {
    expect(vencida({ status: "ABERTA", prazo: "2026-10-08T00:00:00Z" }, AGORA)).toBe(true);
    expect(vencida({ status: "RESOLVIDA", prazo: "2026-10-08T00:00:00Z" }, AGORA)).toBe(false);
    expect(vencida({ status: "ABERTA", prazo: null }, AGORA)).toBe(false);
    expect(resultadosPara("EXTRAVIO")).toEqual(["ENCONTRADO", "INDENIZADO"]);
  });
});
