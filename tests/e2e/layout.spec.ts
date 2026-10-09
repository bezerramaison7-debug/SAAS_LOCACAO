import { expect, test } from "@playwright/test";

import { dispositivo, larguraExcedente, ROTAS_MODULOS } from "./helpers";
import { arquivoSessao } from "./support/usuarios";

test.use({ storageState: arquivoSessao("adminA") });

test.describe("layout responsivo", () => {
  test("nenhuma tela tem rolagem horizontal", async ({ page }) => {
    for (const rota of ROTAS_MODULOS) {
      await page.goto(rota);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await larguraExcedente(page), rota).toBeLessThanOrEqual(0);
    }
  });

  test("módulos não entregues informam a fase e não exibem dados nem ações", async ({ page }) => {
    await page.goto("/devolucoes");
    await expect(page.getByText("Devoluções: disponível a partir da Fase 7")).toBeVisible();
    await expect(page.locator("main").getByRole("button")).toHaveCount(0);
    await expect(page.locator("main table")).toHaveCount(0);
  });

  test("texto principal tem pelo menos 16px", async ({ page }) => {
    await page.goto("/dashboard");
    const tamanho = await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
    expect(tamanho).toBeGreaterThanOrEqual(16);
  });

  test("alvos de toque da navegação têm pelo menos 44×44px", async ({ page }, testInfo) => {
    await page.goto("/dashboard");
    const nav = page.getByRole("navigation", { name: "Menu principal" });
    const alvos = nav.locator("a:visible, button:visible");
    const quantidade = await alvos.count();
    expect(quantidade).toBeGreaterThan(0);
    for (let i = 0; i < quantidade; i++) {
      const caixa = await alvos.nth(i).boundingBox();
      expect(caixa, `${testInfo.project.name} alvo ${i}`).not.toBeNull();
      expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(caixa?.width ?? 0).toBeGreaterThanOrEqual(44);
    }
  });

  test("celular e tablet: navegação inferior compacta com menu completo", async ({
    page,
  }, testInfo) => {
    test.skip(dispositivo(testInfo) === "desktop", "Somente telas menores que 1024px");
    await page.goto("/dashboard");
    const nav = page.getByRole("navigation", { name: "Menu principal" });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link", { name: "Painel" })).toHaveAttribute("aria-current", "page");

    await nav.getByRole("button", { name: "Mais" }).click();
    const menu = page.getByRole("dialog", { name: "Menu" });
    await expect(menu).toBeVisible();
    await menu.getByRole("link", { name: "Ocorrências" }).click();
    await expect(page).toHaveURL(/\/ocorrencias$/);
    await expect(menu).toBeHidden();
    await expect(page.getByRole("heading", { level: 1, name: "Ocorrências" })).toBeVisible();
  });

  test("desktop: sidebar recolhível com estado persistido", async ({ page }, testInfo) => {
    test.skip(dispositivo(testInfo) !== "desktop", "Somente desktop");
    await page.goto("/dashboard");
    const sidebar = page.locator("aside");
    await expect(sidebar).toHaveAttribute("data-recolhida", "false");
    await expect(sidebar.getByRole("link", { name: "Locações", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Recolher menu" }).click();
    await expect(sidebar).toHaveAttribute("data-recolhida", "true");
    // Rótulo continua acessível (sr-only) mesmo recolhida.
    await expect(sidebar.getByRole("link", { name: "Locações", exact: true })).toBeVisible();

    await page.reload();
    await expect(page.locator("aside")).toHaveAttribute("data-recolhida", "true");
    await page.getByRole("button", { name: "Expandir menu" }).click();
    await expect(page.locator("aside")).toHaveAttribute("data-recolhida", "false");
  });
});
