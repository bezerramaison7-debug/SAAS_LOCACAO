import { describe, expect, it } from "vitest";

import { bemSchema, destinoSchema, lerRespostas, loteSchema } from "./schemas";

const ID = "a3000000-0000-4000-8000-000000000002";
const AGORA = Date.parse("2026-10-08T15:00:00Z");

describe("destinoSchema", () => {
  const schema = destinoSchema("America/Sao_Paulo", () => AGORA);
  it("converte o horário de parede da empresa para UTC", () => {
    const r = schema.parse({
      dataEvento: "2026-10-08T09:30",
      localId: ID,
      responsavelId: ID,
      observacoes: "",
    });
    expect(r.dataEvento).toBe("2026-10-08T12:30:00.000Z");
  });
  it("rejeita data futura (além de 5 min) e campos vazios", () => {
    const r = schema.safeParse({
      dataEvento: "2026-10-08T12:30",
      localId: "",
      responsavelId: "",
      observacoes: "",
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path[0]).sort()).toEqual([
      "dataEvento",
      "localId",
      "responsavelId",
    ]);
  });
});

describe("bemSchema", () => {
  it("exige somente a identificação pedida pela categoria", () => {
    const schema = bemSchema({ numeroSerie: true, placa: false, identificacaoFornecedor: false });
    expect(
      schema.safeParse({
        numeroSerie: "",
        placa: "",
        identificacaoFornecedor: "",
        condicao: "BOM",
        observacao: "",
      }).success,
    ).toBe(false);
    expect(
      schema.parse({
        numeroSerie: " SN-1 ",
        placa: "",
        identificacaoFornecedor: "",
        condicao: "BOM",
        observacao: "",
      }),
    ).toEqual({
      numeroSerie: "SN-1",
      placa: null,
      identificacaoFornecedor: null,
      condicao: "BOM",
      observacao: null,
    });
  });
});

describe("loteSchema", () => {
  it("quantidade em pt-BR maior que zero", () => {
    expect(
      loteSchema.parse({ quantidade: "12,5", condicao: "BOM", observacao: "" }).quantidade,
    ).toBe("12.5");
    expect(loteSchema.safeParse({ quantidade: "0", condicao: "BOM", observacao: "" }).success).toBe(
      false,
    );
  });
});

describe("lerRespostas", () => {
  const perguntas = [
    { id: "p1", tipoResposta: "CONFORME_NAO_CONFORME" as const, opcoes: null },
    { id: "p2", tipoResposta: "NUMERO" as const, opcoes: null },
    { id: "p3", tipoResposta: "OPCAO_UNICA" as const, opcoes: ["A", "B"] },
    { id: "p4", tipoResposta: "TEXTO" as const, opcoes: null },
  ];
  it("converte por tipo e ignora vazias", () => {
    const { respostas, erros } = lerRespostas(perguntas, {
      resposta_p1: "NAO_CONFORME",
      resposta_p2: "1,5",
      resposta_p3: "B",
    });
    expect(erros).toEqual({});
    expect([...respostas]).toEqual([
      ["p1", "NAO_CONFORME"],
      ["p2", 1.5],
      ["p3", "B"],
    ]);
  });
  it("número aceita vírgula decimal, milhar e ponto decimal", () => {
    const ler = (v: string) => lerRespostas(perguntas, { resposta_p2: v }).respostas.get("p2");
    expect([ler("1.234,5"), ler("1.5"), ler("7")]).toEqual([1234.5, 1.5, 7]);
  });
  it("aponta valores fora das opções", () => {
    const { erros } = lerRespostas(perguntas, {
      resposta_p1: "TALVEZ",
      resposta_p2: "abc",
      resposta_p3: "Z",
    });
    expect(Object.keys(erros)).toEqual(["resposta_p1", "resposta_p2", "resposta_p3"]);
  });
});
