import { describe, expect, it } from "vitest";

import { descreverExigeFoto, linhas, perguntaSchema } from "./schemas";

const base = {
  ordem: "1",
  texto: "Estado geral",
  tipoResposta: "CONFORME_NAO_CONFORME",
  opcoes: "",
  obrigatoria: "on",
  fotoModo: "NUNCA",
  fotoRespostas: [] as string[],
};

describe("perguntaSchema", () => {
  it("aceita pergunta simples e normaliza", () => {
    expect(perguntaSchema.parse(base)).toEqual({
      ordem: 1,
      texto: "Estado geral",
      tipoResposta: "CONFORME_NAO_CONFORME",
      opcoes: null,
      obrigatoria: true,
      exigeFoto: { modo: "NUNCA" },
    });
  });

  it("exige ao menos 2 opções distintas para OPCAO_UNICA", () => {
    expect(
      perguntaSchema.safeParse({ ...base, tipoResposta: "OPCAO_UNICA", opcoes: "Única" }).success,
    ).toBe(false);
    expect(
      perguntaSchema.safeParse({ ...base, tipoResposta: "OPCAO_UNICA", opcoes: "A\nA" }).success,
    ).toBe(false);
    const ok = perguntaSchema.parse({
      ...base,
      tipoResposta: "OPCAO_UNICA",
      opcoes: " Completo \n\nIncompleto\r\n",
    });
    expect(ok.opcoes).toEqual(["Completo", "Incompleto"]);
  });

  it("descarta opções digitadas quando o tipo não é OPCAO_UNICA", () => {
    expect(perguntaSchema.parse({ ...base, opcoes: "A\nB" }).opcoes).toBeNull();
  });

  it("foto por resposta valida as respostas contra o tipo", () => {
    const ok = perguntaSchema.parse({
      ...base,
      fotoModo: "RESPOSTAS",
      fotoRespostas: ["NAO_CONFORME"],
    });
    expect(ok.exigeFoto).toEqual({ modo: "RESPOSTAS", respostas: ["NAO_CONFORME"] });
    expect(
      perguntaSchema.safeParse({ ...base, fotoModo: "RESPOSTAS", fotoRespostas: [] }).success,
    ).toBe(false);
    expect(
      perguntaSchema.safeParse({ ...base, fotoModo: "RESPOSTAS", fotoRespostas: ["NAO"] }).success,
    ).toBe(false);
  });

  it("foto por resposta em OPCAO_UNICA usa as opções informadas", () => {
    const d = {
      ...base,
      tipoResposta: "OPCAO_UNICA",
      opcoes: "Completo\nIncompleto",
      fotoModo: "RESPOSTAS",
    };
    expect(perguntaSchema.safeParse({ ...d, fotoRespostas: ["Incompleto"] }).success).toBe(true);
    expect(perguntaSchema.safeParse({ ...d, fotoRespostas: ["Outro"] }).success).toBe(false);
  });

  it("texto livre não aceita foto por resposta", () => {
    const r = perguntaSchema.safeParse({
      ...base,
      tipoResposta: "TEXTO",
      fotoModo: "RESPOSTAS",
      fotoRespostas: ["x"],
    });
    expect(r.success).toBe(false);
  });

  it("rejeita ordem fora do intervalo", () => {
    expect(perguntaSchema.safeParse({ ...base, ordem: "0" }).success).toBe(false);
    expect(perguntaSchema.safeParse({ ...base, ordem: "1.5" }).success).toBe(false);
  });
});

describe("auxiliares", () => {
  it("linhas ignora vazias", () => expect(linhas("a\n\n b ")).toEqual(["a", "b"]));
  it("descreve a regra de foto com rótulos", () => {
    expect(descreverExigeFoto({ modo: "RESPOSTAS", respostas: ["NAO"] }, "SIM_NAO")).toBe(
      "Foto quando: Não",
    );
    expect(descreverExigeFoto({ modo: "SEMPRE" }, "TEXTO")).toBe("Foto: sempre");
  });
});
