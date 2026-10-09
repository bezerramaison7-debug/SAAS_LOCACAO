import { afterEach, describe, expect, it, vi } from "vitest";

import { logger, medir } from "./logger";
import { redact, VALOR_OCULTO } from "./redact";
import { resolverRequestId } from "./request-id";

describe("redact", () => {
  it("oculta chaves sensíveis em qualquer profundidade", () => {
    const saida = redact({
      email: "a@b.com",
      senha: "123",
      headers: { Authorization: "Bearer x", "x-request-id": "r" },
      sessao: [{ access_token: "t", refresh_token: "r" }],
      SUPABASE_SERVICE_ROLE_KEY: "k",
    });
    expect(saida).toEqual({
      email: "a@b.com",
      senha: VALOR_OCULTO,
      headers: { Authorization: VALOR_OCULTO, "x-request-id": "r" },
      sessao: [{ access_token: VALOR_OCULTO, refresh_token: VALOR_OCULTO }],
      SUPABASE_SERVICE_ROLE_KEY: VALOR_OCULTO,
    });
  });

  it("resume binários e corta ciclos", () => {
    const ciclo: Record<string, unknown> = { nome: "a" };
    ciclo.eu = ciclo;
    expect(redact({ arquivo: new Uint8Array(10) })).toEqual({ arquivo: "[BINÁRIO 10 bytes]" });
    expect(redact(ciclo)).toEqual({ nome: "a", eu: "[CICLO]" });
  });

  it("serializa erros sem stack", () => {
    expect(redact({ erro: new Error("falhou") })).toEqual({
      erro: { name: "Error", message: "falhou" },
    });
  });
});

describe("request id", () => {
  it("aceita UUID válido e normaliza para minúsculas", () => {
    const id = "3CD7A1E2-5B4F-4C3D-9A8B-1234567890AB";
    expect(resolverRequestId(id)).toBe(id.toLowerCase());
  });

  it("gera novo id para valores ausentes ou maliciosos", () => {
    const gerado = resolverRequestId('abc"\n{injetado}');
    expect(gerado).toMatch(/^[0-9a-f-]{36}$/);
    expect(resolverRequestId(null)).not.toBe(resolverRequestId(null));
  });
});

describe("logger", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("escreve JSON com contexto e sem segredos", () => {
    vi.stubEnv("LOG_IN_TESTS", "1");
    const espiao = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("upload.falhou", { modulo: "storage", request_id: "r1", token: "abc" });
    const linha = JSON.parse(String(espiao.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(linha).toMatchObject({
      level: "error",
      msg: "upload.falhou",
      modulo: "storage",
      request_id: "r1",
      token: VALOR_OCULTO,
    });
  });

  it("medir registra duração e relança o erro original", async () => {
    vi.stubEnv("LOG_IN_TESTS", "1");
    const espiao = vi.spyOn(console, "error").mockImplementation(() => {});
    const erro = new Error("boom");
    await expect(
      medir({ modulo: "pdf", operacao: "gerar" }, () => Promise.reject(erro)),
    ).rejects.toBe(erro);
    const linha = JSON.parse(String(espiao.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(linha).toMatchObject({ msg: "operacao.falhou", modulo: "pdf", operacao: "gerar" });
    expect(typeof linha.duracao_ms).toBe("number");
  });
});
