import { describe, expect, it } from "vitest";

import { traduzirErroBanco } from "./erros";

describe("traduzirErroBanco", () => {
  it("permissão negada nunca expõe detalhes", () => {
    expect(
      traduzirErroBanco({ code: "42501", message: "permission denied for table locacoes" }),
    ).toEqual({
      codigo: "SEM_PERMISSAO",
      mensagem: "Você não tem permissão para esta operação.",
    });
  });

  it("mensagens das funções de domínio são exibidas", () => {
    expect(
      traduzirErroBanco({ code: "22023", message: "Informe o motivo com pelo menos 10 caracteres" })
        .mensagem,
    ).toBe("Informe o motivo com pelo menos 10 caracteres");
    expect(traduzirErroBanco({ code: "P0002", message: "Associação não encontrada" }).codigo).toBe(
      "NAO_ENCONTRADO",
    );
    expect(
      traduzirErroBanco({
        code: "23514",
        message: "A empresa precisa manter ao menos um ADMIN ativo",
      }).mensagem,
    ).toBe("A empresa precisa manter ao menos um ADMIN ativo");
  });

  it("mensagens cruas do Postgres viram mensagem genérica", () => {
    expect(
      traduzirErroBanco({
        code: "23514",
        message: 'new row for relation "lotes" violates check constraint "x"',
      }).mensagem,
    ).toBe("Dados inválidos. Revise os campos e tente novamente.");
    expect(
      traduzirErroBanco({
        code: "23505",
        message: 'duplicate key value violates unique constraint "x"',
      }).mensagem,
    ).toBe("Já existe um registro com estes dados.");
    expect(traduzirErroBanco({ code: "XX000", message: "internal" }).codigo).toBe("DESCONHECIDO");
  });

  it("transição inválida e indisponibilidade", () => {
    expect(
      traduzirErroBanco({
        code: "23514",
        message: "Transição de estado não permitida (bem): A → B",
      }).codigo,
    ).toBe("TRANSICAO_INVALIDA");
    expect(traduzirErroBanco({ message: "TypeError: fetch failed" }).codigo).toBe("INDISPONIVEL");
    expect(traduzirErroBanco(null).codigo).toBe("DESCONHECIDO");
  });
});
