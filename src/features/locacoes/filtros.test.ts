import { describe, expect, it } from "vitest";

import { lerFiltrosLocacao, somarDias, temFiltroAtivo, termoLiteral } from "./filtros";

const UUID = "a2000000-0000-4000-8000-000000000001";

describe("lerFiltrosLocacao", () => {
  it("padrões sem parâmetros", () => {
    const f = lerFiltrosLocacao({});
    expect(f).toMatchObject({
      q: "",
      status: [],
      fornecedor: null,
      termino: null,
      paginacao: { pagina: 1, tamanho: 25 },
    });
    expect(temFiltroAtivo(f)).toBe(false);
  });

  it("status repetido ou separado por vírgula, sem duplicar e ignorando inválidos", () => {
    expect(lerFiltrosLocacao({ status: ["ATIVA", "RASCUNHO,ATIVA", "XPTO"] }).status).toEqual([
      "ATIVA",
      "RASCUNHO",
    ]);
  });

  it("ignora ids e datas inválidos e ordena o período", () => {
    const f = lerFiltrosLocacao({
      fornecedor: "1 or 1=1",
      centro: UUID,
      de: "2026-12-31",
      ate: "2026-01-01",
      local: "x",
    });
    expect(f.fornecedor).toBeNull();
    expect(f.centro).toBe(UUID);
    expect(f.local).toBeNull();
    expect([f.de, f.ate]).toEqual(["2026-01-01", "2026-12-31"]);
    expect(lerFiltrosLocacao({ de: "2026-02-30" }).de).toBeNull();
  });

  it("prazo de término só 7, 15 ou 30 e tamanho de página só 25/50/100", () => {
    expect(lerFiltrosLocacao({ termino: "15" }).termino).toBe(15);
    expect(lerFiltrosLocacao({ termino: "10" }).termino).toBeNull();
    expect(lerFiltrosLocacao({ tamanho: "50", pagina: "3" }).paginacao).toEqual({
      pagina: 3,
      tamanho: 50,
    });
    expect(lerFiltrosLocacao({ tamanho: "1000" }).paginacao.tamanho).toBe(25);
  });
});

describe("auxiliares", () => {
  it("somarDias atravessa meses e anos", () => {
    expect(somarDias("2026-12-28", 7)).toBe("2027-01-04");
    expect(somarDias("2028-02-27", 2)).toBe("2028-02-29");
  });
  it("termoLiteral escapa curingas do ILIKE", () => {
    expect(termoLiteral("50%_a\\b")).toBe("50\\%\\_a\\\\b");
  });
});
