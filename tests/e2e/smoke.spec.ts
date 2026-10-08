import { expect, test } from "@playwright/test";

test.describe("smoke", () => {
  test("raiz redireciona para o painel", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { level: 1, name: "Painel" })).toBeVisible();
    await expect(page).toHaveTitle("Painel · Rastreio de Locações");
  });

  test("health responde sem cache e sem detalhes internos", async ({ request }) => {
    const resposta = await request.get("/api/health");
    expect(resposta.status()).toBe(200);
    expect(resposta.headers()["cache-control"]).toContain("no-store");
    const corpo = (await resposta.json()) as Record<string, unknown>;
    expect(Object.keys(corpo).sort()).toEqual(["status", "verificado_em"]);
    expect(corpo.status).toBe("ok");
  });

  test("cabeçalhos de segurança e request id", async ({ request }) => {
    const resposta = await request.get("/dashboard");
    const h = resposta.headers();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["x-powered-by"]).toBeUndefined();
    expect(h["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    const csp = h["content-security-policy"] ?? "";
    expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("unsafe-eval");
  });

  test("nonce da CSP muda a cada requisição e é aplicado aos scripts", async ({
    page,
    request,
  }) => {
    const a = (await request.get("/dashboard")).headers()["content-security-policy"];
    const b = (await request.get("/dashboard")).headers()["content-security-policy"];
    expect(a).not.toBe(b);

    const violacoes: string[] = [];
    page.on("console", (msg) => {
      if (/Content Security Policy|Refused to/i.test(msg.text())) violacoes.push(msg.text());
    });
    await page.goto("/locacoes");
    await expect(page.getByRole("heading", { level: 1, name: "Locações" })).toBeVisible();
    expect(violacoes).toEqual([]);
  });

  test("request id válido recebido é reaproveitado; inválido é substituído", async ({
    request,
  }) => {
    const id = "3cd7a1e2-5b4f-4c3d-9a8b-1234567890ab";
    const ok = await request.get("/api/health", { headers: { "x-request-id": id } });
    expect(ok.headers()["x-request-id"]).toBe(id);
    const ruim = await request.get("/api/health", { headers: { "x-request-id": "<script>" } });
    expect(ruim.headers()["x-request-id"]).not.toBe("<script>");
  });

  test("rota inexistente mostra página 404 em português", async ({ page }) => {
    const resposta = await page.goto("/nao-existe");
    expect(resposta?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  });
});

test("health profundo informa prontidão do Supabase sem detalhes internos", async ({ request }) => {
  const resposta = await request.get("/api/health?profundo=1");
  expect([200, 503]).toContain(resposta.status());
  expect(resposta.headers()["cache-control"]).toContain("no-store");
  const corpo = (await resposta.json()) as { dependencias: { supabase: string } };
  expect(Object.keys(corpo).sort()).toEqual(["dependencias", "status", "verificado_em"]);
  expect(["ok", "indisponivel"]).toContain(corpo.dependencias.supabase);
});
