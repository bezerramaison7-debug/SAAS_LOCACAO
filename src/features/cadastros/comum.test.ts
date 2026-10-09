import { describe, expect, it } from "vitest";

import { codigoSchema, lerFiltrosCadastro, textoOpcional } from "./comum";

describe("filtros de cadastro", () => {
  it("padrões e valores inválidos", () => {
    expect(lerFiltrosCadastro({})).toEqual({
      q: "",
      situacao: "ativos",
      paginacao: { pagina: 1, tamanho: 25 },
    });
    expect(
      lerFiltrosCadastro({ q: "  obra ", situacao: "xyz", pagina: "2", tamanho: "50" }),
    ).toEqual({
      q: "obra",
      situacao: "ativos",
      paginacao: { pagina: 2, tamanho: 50 },
    });
    expect(lerFiltrosCadastro({ situacao: ["todos", "ativos"] }).situacao).toBe("todos");
  });

  it("código normalizado em maiúsculas e validado", () => {
    expect(codigoSchema.parse(" obra-01 ")).toBe("OBRA-01");
    expect(codigoSchema.safeParse("com espaço").success).toBe(false);
  });

  it("texto opcional vazio vira null", () => {
    expect(textoOpcional(10).parse("  ")).toBeNull();
    expect(textoOpcional(3).safeParse("abcd").success).toBe(false);
  });
});
