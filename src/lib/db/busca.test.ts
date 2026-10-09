import { describe, expect, it } from "vitest";

import { filtroBuscaIlike } from "./busca";

describe("filtroBuscaIlike", () => {
  it("gera OR entre colunas com o termo entre aspas", () => {
    expect(filtroBuscaIlike(["nome", "codigo"], " obra ")).toBe(
      'nome.ilike."%obra%",codigo.ilike."%obra%"',
    );
  });

  it("vazio → sem filtro", () => {
    expect(filtroBuscaIlike(["nome"], "   ")).toBeNull();
  });

  it("vírgulas, parênteses e aspas não injetam filtros", () => {
    const f = filtroBuscaIlike(["nome"], 'a,b),id.eq.1"x');
    expect(f).toBe('nome.ilike."%a,b),id.eq.1\\"x%"');
  });

  it("curingas do usuário viram texto literal", () => {
    expect(filtroBuscaIlike(["nome"], "50%_off")).toBe('nome.ilike."%50\\\\%\\\\_off%"');
  });

  it("rejeita nome de coluna inseguro", () => {
    expect(() => filtroBuscaIlike(["nome;drop"], "x")).toThrow();
  });
});
