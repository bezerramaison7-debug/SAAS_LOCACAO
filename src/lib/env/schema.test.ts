import { describe, expect, it } from "vitest";

import { clientEnvSchema, EnvValidationError, parseEnv, serverEnvSchema } from "./schema";

const valido = {
  NEXT_PUBLIC_APP_URL: "https://locacoes.exemplo.com.br/",
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_xyz",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_super_secreto",
  REPORT_SIGNING_SECRET: "a".repeat(32),
  SENTRY_DSN: "",
};

describe("validação de ambiente", () => {
  it("aceita configuração completa e normaliza URLs", () => {
    const env = parseEnv(serverEnvSchema, valido, "teste");
    expect(env.NEXT_PUBLIC_APP_URL).toBe("https://locacoes.exemplo.com.br");
    expect(env.SENTRY_DSN).toBeUndefined();
  });

  it("lista todas as variáveis ausentes de uma vez", () => {
    try {
      parseEnv(serverEnvSchema, {}, "teste");
      expect.unreachable();
    } catch (erro) {
      expect(erro).toBeInstanceOf(EnvValidationError);
      const { problemas, message } = erro as EnvValidationError;
      expect(problemas).toEqual(
        expect.arrayContaining([
          "NEXT_PUBLIC_APP_URL: ausente",
          "NEXT_PUBLIC_SUPABASE_URL: ausente",
          "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ausente",
          "SUPABASE_SERVICE_ROLE_KEY: ausente",
          "REPORT_SIGNING_SECRET: ausente",
        ]),
      );
      expect(message).toContain(".env.example");
    }
  });

  it("rejeita segredo de relatório curto sem expor o valor", () => {
    const segredo = "curto-demais-123";
    try {
      parseEnv(serverEnvSchema, { ...valido, REPORT_SIGNING_SECRET: segredo }, "teste");
      expect.unreachable();
    } catch (erro) {
      const { message } = erro as EnvValidationError;
      expect(message).toContain("REPORT_SIGNING_SECRET: deve ter pelo menos 32 caracteres");
      expect(message).not.toContain(segredo);
    }
  });

  it("rejeita URL inválida e protocolo não http", () => {
    expect(() =>
      parseEnv(clientEnvSchema, { ...valido, NEXT_PUBLIC_SUPABASE_URL: "ftp://x" }, "t"),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("schema público não contém nenhuma variável secreta", () => {
    const chaves = Object.keys(clientEnvSchema.shape);
    expect(chaves.every((c) => c.startsWith("NEXT_PUBLIC_"))).toBe(true);
  });
});
