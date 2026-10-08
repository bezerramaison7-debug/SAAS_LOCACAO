import { describe, expect, it } from "vitest";

import { convidarUsuarioSchema, definirAtivoSchema } from "@/features/usuarios/schemas";

import { empresaSchema, FUSOS_BRASIL, perfilSchema } from "./schemas";

describe("configurações", () => {
  it("todos os fusos oferecidos são válidos no Intl", () => {
    for (const fuso of FUSOS_BRASIL) {
      expect(() => new Intl.DateTimeFormat("pt-BR", { timeZone: fuso })).not.toThrow();
    }
  });

  it("empresa: checkbox, limites e fuso", () => {
    expect(
      empresaSchema.parse({
        nome: "Empresa X",
        timezone: "America/Manaus",
        exigeAceite: "on",
        limiteAtrasoHoras: "48",
      }),
    ).toEqual({
      nome: "Empresa X",
      timezone: "America/Manaus",
      exigeAceite: true,
      limiteAtrasoHoras: 48,
    });
    expect(
      empresaSchema.parse({ nome: "Empresa X", timezone: "America/Manaus", limiteAtrasoHoras: "1" })
        .exigeAceite,
    ).toBe(false);
    expect(
      empresaSchema.safeParse({ nome: "X Y", timezone: "Europe/Lisbon", limiteAtrasoHoras: "24" })
        .success,
    ).toBe(false);
    expect(
      empresaSchema.safeParse({ nome: "X Y", timezone: "America/Manaus", limiteAtrasoHoras: "0" })
        .success,
    ).toBe(false);
  });

  it("perfil: telefone opcional", () => {
    expect(perfilSchema.parse({ nome: "Ana", telefone: "" }).telefone).toBeNull();
    expect(perfilSchema.safeParse({ nome: "Ana", telefone: "abc" }).success).toBe(false);
  });

  it("usuários: papel válido e motivo obrigatório para desativar", () => {
    expect(
      convidarUsuarioSchema.safeParse({ email: "a@b.com", nome: "Ana", papel: "SUPERUSER" })
        .success,
    ).toBe(false);
    expect(
      definirAtivoSchema.safeParse({
        associacaoId: "3cd7a1e2-5b4f-4c3d-9a8b-1234567890ab",
        ativo: "false",
        motivo: "curto",
      }).success,
    ).toBe(false);
    expect(
      definirAtivoSchema.parse({
        associacaoId: "3cd7a1e2-5b4f-4c3d-9a8b-1234567890ab",
        ativo: "true",
        motivo: "Retorno de férias coletivas",
      }).ativo,
    ).toBe(true);
  });
});
