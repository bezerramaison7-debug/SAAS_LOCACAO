import { describe, expect, it } from "vitest";

import { montarUrlListagem } from "./url";

describe("montarUrlListagem", () => {
  it("preserva filtros e altera a página", () => {
    expect(
      montarUrlListagem(
        "/locacoes",
        { status: ["ATIVA", "EM_DEVOLUCAO"], q: "LOC-1" },
        { pagina: 2 },
      ),
    ).toBe("/locacoes?pagina=2&q=LOC-1&status=ATIVA&status=EM_DEVOLUCAO");
  });

  it("mudar o tamanho da página volta para a página 1", () => {
    expect(montarUrlListagem("/bens", { pagina: "4", q: "série" }, { tamanho: 50 })).toBe(
      "/bens?q=s%C3%A9rie&tamanho=50",
    );
  });

  it("remove parâmetros nulos e omite pagina=1", () => {
    expect(montarUrlListagem("/bens", { tamanho: "50" }, { tamanho: null, pagina: 1 })).toBe(
      "/bens",
    );
  });

  it("codifica valores com caracteres especiais (sem injeção na URL)", () => {
    expect(montarUrlListagem("/x", {}, { q: "a&b=c#d" })).toBe("/x?q=a%26b%3Dc%23d");
  });
});
