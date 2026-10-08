import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { itemAtivo, NAVEGACAO } from "./navegacao";

describe("navegação", () => {
  it("todo item aponta para uma rota existente em src/app/(app)", () => {
    const raiz = path.join(import.meta.dirname, "../../app/(app)");
    for (const { href } of NAVEGACAO) {
      expect(existsSync(path.join(raiz, href, "page.tsx")), href).toBe(true);
    }
  });

  it("no máximo 4 atalhos na barra do celular (mais o botão 'Mais')", () => {
    expect(NAVEGACAO.filter((i) => i.atalhoMovel).length).toBeLessThanOrEqual(4);
  });

  it("marca item ativo inclusive em sub-rotas, sem falso positivo por prefixo", () => {
    expect(itemAtivo("/locacoes/123", "/locacoes")).toBe(true);
    expect(itemAtivo("/locacoes", "/locacoes")).toBe(true);
    expect(itemAtivo("/locacoes-arquivadas", "/locacoes")).toBe(false);
  });
});
