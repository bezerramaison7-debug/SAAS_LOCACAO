import { describe, expect, it } from "vitest";

import { gerarNonce, montarCsp } from "./csp";

describe("CSP", () => {
  it("gera nonces imprevisíveis em base64", () => {
    const a = gerarNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(a).not.toBe(gerarNonce());
  });

  it("produção: sem unsafe-eval/unsafe-inline em scripts e com frame-ancestors none", () => {
    const csp = montarCsp({ nonce: "abc", supabaseUrl: "https://x.supabase.co/", dev: false });
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("connect-src 'self' https://x.supabase.co");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("desenvolvimento libera eval e websocket do HMR", () => {
    const csp = montarCsp({ nonce: "n", supabaseUrl: "http://127.0.0.1:54321", dev: true });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("ws:");
    expect(csp).toContain("http://127.0.0.1:54321");
  });
});
