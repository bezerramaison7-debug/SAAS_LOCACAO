import { describe, expect, it } from "vitest";

import { ehCookieDeAuth, opcoesCookieAuth } from "./cookies";

describe("cookies de autenticação", () => {
  it("são HttpOnly e SameSite=Lax", () => {
    expect(opcoesCookieAuth()).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
  });

  it("reconhece cookies (inclusive fragmentados) do Supabase", () => {
    expect(ehCookieDeAuth("sb-abcd-auth-token")).toBe(true);
    expect(ehCookieDeAuth("sb-abcd-auth-token.0")).toBe(true);
    expect(ehCookieDeAuth("tema")).toBe(false);
  });
});
