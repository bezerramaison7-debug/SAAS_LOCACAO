import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import { permissoesDoPapel } from "@/lib/permissions/matriz";

import { AcessoNegadoError, exigirPermissao, exigirPermissaoPagina, pode } from "./autorizacao";

const ctx = (papel: Parameters<typeof permissoesDoPapel>[0]) => ({
  permissoes: permissoesDoPapel(papel),
});

describe("autorização no servidor", () => {
  it("pode() segue a matriz", () => {
    expect(pode(ctx("ADMIN"), "usuarios.gerenciar")).toBe(true);
    expect(pode(ctx("GESTOR"), "usuarios.gerenciar")).toBe(false);
  });

  it("exigirPermissao lança erro tipado com a permissão faltante", () => {
    expect(() => exigirPermissao(ctx("AUDITOR"), "locacao.criar")).toThrow(AcessoNegadoError);
    try {
      exigirPermissao(ctx("OPERACAO"), "locacao.encerrar_financeiro");
    } catch (e) {
      expect((e as AcessoNegadoError).permissao).toBe("locacao.encerrar_financeiro");
    }
    expect(() => exigirPermissao(ctx("FINANCEIRO"), "locacao.encerrar_financeiro")).not.toThrow();
  });

  it("páginas sem permissão respondem 404", () => {
    expect(() => exigirPermissaoPagina(ctx("RESPONSAVEL_LOCAL"), "usuarios.gerenciar")).toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(() => exigirPermissaoPagina(ctx("ADMIN"), "usuarios.gerenciar")).not.toThrow();
  });
});
