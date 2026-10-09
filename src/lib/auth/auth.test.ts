import { describe, expect, it } from "vitest";

import { resolverEmpresaAtiva, type Associacao } from "./empresa-ativa";
import { destinoSeguro, rotaPublica } from "./redirecionamento";

const a: Associacao = {
  empresaId: "a",
  empresaNome: "A",
  timezone: "America/Sao_Paulo",
  papel: "ADMIN",
};
const b: Associacao = {
  empresaId: "b",
  empresaNome: "B",
  timezone: "America/Manaus",
  papel: "GESTOR",
};

describe("resolverEmpresaAtiva", () => {
  it("sem associação → sem_empresa", () => {
    expect(resolverEmpresaAtiva([], "a")).toEqual({ tipo: "sem_empresa" });
  });

  it("uma associação é usada mesmo sem preferência ou com preferência inválida", () => {
    expect(resolverEmpresaAtiva([a], undefined)).toEqual({ tipo: "ok", associacao: a });
    expect(resolverEmpresaAtiva([a], "empresa-de-outro")).toEqual({ tipo: "ok", associacao: a });
  });

  it("várias associações: usa a preferida válida, senão pede escolha", () => {
    expect(resolverEmpresaAtiva([a, b], "b")).toEqual({ tipo: "ok", associacao: b });
    expect(resolverEmpresaAtiva([a, b], undefined).tipo).toBe("escolher");
  });

  it("cookie com empresa à qual o usuário não pertence é ignorado (não autoriza)", () => {
    expect(resolverEmpresaAtiva([a, b], "c").tipo).toBe("escolher");
  });
});

describe("destinoSeguro", () => {
  it.each([
    ["/locacoes?status=ATIVA", "/locacoes?status=ATIVA"],
    ["/bens/123", "/bens/123"],
    [null, "/dashboard"],
    ["https://malicioso.com", "/dashboard"],
    ["//malicioso.com/x", "/dashboard"],
    ["/\\malicioso.com", "/dashboard"],
    ["javascript:alert(1)", "/dashboard"],
    ["/ok\nSet-Cookie: x", "/dashboard"],
  ])("%s → %s", (entrada, esperado) => {
    expect(destinoSeguro(entrada)).toBe(esperado);
  });
});

describe("rotaPublica", () => {
  it.each([
    ["/login", true],
    ["/recuperar-senha", true],
    ["/recuperar-senha/redefinir", true],
    ["/auth/confirm", true],
    ["/api/health", true],
    ["/dashboard", false],
    ["/loginx", false],
    ["/api/files", false],
    ["/api/reports/process", true],
    ["/api/reports", false],
    ["/api/reports/x/download", false],
  ])("%s → %s", (rota, esperado) => {
    expect(rotaPublica(rota)).toBe(esperado);
  });
});
