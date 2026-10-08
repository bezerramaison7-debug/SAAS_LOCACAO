import { describe, expect, it, vi } from "vitest";

import { verificarSupabase } from "./saude";

describe("verificarSupabase", () => {
  it("ok quando o Auth responde 2xx, enviando a chave pública", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    expect(await verificarSupabase("https://x.supabase.co", "pub", fetchFalso)).toBe("ok");
    const [url, init] = fetchFalso.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://x.supabase.co/auth/v1/health");
    expect(init.headers).toEqual({ apikey: "pub" });
  });

  it("indisponível em erro HTTP, falha de rede ou timeout (sem lançar)", async () => {
    expect(
      await verificarSupabase(
        "https://x",
        "p",
        vi.fn().mockResolvedValue(new Response("", { status: 503 })),
      ),
    ).toBe("indisponivel");
    expect(
      await verificarSupabase("https://x", "p", vi.fn().mockRejectedValue(new TypeError("rede"))),
    ).toBe("indisponivel");
    const lento: typeof fetch = (_url, init) =>
      new Promise((_, rejeitar) =>
        init?.signal?.addEventListener("abort", () => rejeitar(new Error("abort"))),
      );
    expect(await verificarSupabase("https://x", "p", lento, 10)).toBe("indisponivel");
  });
});
