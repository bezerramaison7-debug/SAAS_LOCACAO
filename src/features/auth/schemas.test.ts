import { describe, expect, it } from "vitest";

import {
  loginSchema,
  mensagemErroLogin,
  recuperarSenhaSchema,
  redefinirSenhaSchema,
} from "./schemas";

describe("schemas de autenticação", () => {
  it("login normaliza e-mail e exige senha", () => {
    expect(loginSchema.parse({ email: "  Admin.A@Demo.Test ", senha: "x" }).email).toBe(
      "admin.a@demo.test",
    );
    const r = loginSchema.safeParse({ email: "invalido", senha: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const campos = r.error.issues.map((i) => i.path[0]);
      expect(campos).toEqual(expect.arrayContaining(["email", "senha"]));
    }
  });

  it("política de senha forte e confirmação", () => {
    expect(redefinirSenhaSchema.safeParse({ senha: "Curta1", confirmacao: "Curta1" }).success).toBe(
      false,
    );
    expect(
      redefinirSenhaSchema.safeParse({ senha: "semmaiuscula1", confirmacao: "semmaiuscula1" })
        .success,
    ).toBe(false);
    expect(
      redefinirSenhaSchema.safeParse({ senha: "SemNumeroAqui", confirmacao: "SemNumeroAqui" })
        .success,
    ).toBe(false);
    const diferente = redefinirSenhaSchema.safeParse({
      senha: "Valida12345",
      confirmacao: "Valida12346",
    });
    expect(diferente.success).toBe(false);
    if (!diferente.success) expect(diferente.error.issues[0]?.path).toEqual(["confirmacao"]);
    expect(
      redefinirSenhaSchema.safeParse({ senha: "Valida12345", confirmacao: "Valida12345" }).success,
    ).toBe(true);
  });

  it("recuperação valida e-mail", () => {
    expect(recuperarSenhaSchema.safeParse({ email: "a@b" }).success).toBe(false);
  });

  it("mensagens específicas sem enumerar contas", () => {
    expect(mensagemErroLogin("invalid_credentials")).toBe("E-mail ou senha incorretos.");
    expect(mensagemErroLogin("over_request_rate_limit")).toMatch(/Muitas tentativas/);
    expect(mensagemErroLogin(undefined)).toMatch(/Tente novamente/);
    expect(mensagemErroLogin("user_not_found")).not.toMatch(/não existe|não encontrado/i);
  });
});
