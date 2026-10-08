import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { dispositivo } from "./helpers";
import { arquivoSessao } from "./support/usuarios";

test.use({ storageState: arquivoSessao("adminA") });

for (const tema of ["claro", "escuro"] as const) {
  test(`sem violações sérias de acessibilidade (WCAG A/AA) — tema ${tema}`, async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([{ name: "tema", value: tema, url: baseURL ?? "" }]);
    for (const rota of ["/dashboard", "/locacoes", "/nao-existe"]) {
      await page.goto(rota);
      await expect(page.locator("html")).toHaveAttribute("data-theme", tema);
      const resultado = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      const graves = resultado.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );
      expect(
        graves.map((v) => `${rota}: ${v.id} (${v.nodes.length})`),
        "violações sérias/críticas",
      ).toEqual([]);
    }
  });
}

test("tema escolhido é aplicado e persiste após recarregar", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);

  await page.getByRole("radio", { name: "Tema escuro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "escuro");
  await expect(page.getByRole("radio", { name: "Tema escuro" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  const fundoEscuro = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "escuro");

  await page.getByRole("radio", { name: "Tema claro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "claro");
  const fundoClaro = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(fundoClaro).not.toBe(fundoEscuro);

  await page.getByRole("radio", { name: "Tema do sistema" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
});

test("teclado: link 'Pular para o conteúdo' é o primeiro foco e tem foco visível", async ({
  page,
}, testInfo) => {
  test.skip(dispositivo(testInfo) === "celular", "Teclado físico: tablet/desktop");
  await page.goto("/dashboard");
  await page.keyboard.press("Tab");
  const pular = page.getByRole("link", { name: "Pular para o conteúdo" });
  await expect(pular).toBeFocused();
  await expect(pular).toBeVisible();
  const contorno = await pular.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(contorno).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#conteudo$/);
});

test("teclado: navegação até um módulo apenas com Tab/Enter", async ({ page }, testInfo) => {
  test.skip(dispositivo(testInfo) === "celular", "Teclado físico: tablet/desktop");
  await page.goto("/dashboard");
  const alvo = page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", {
    name: dispositivo(testInfo) === "desktop" ? "Cobranças" : "Locações",
  });
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("Tab");
    if (await alvo.evaluate((el) => el === document.activeElement)) break;
  }
  await expect(alvo).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/(cobrancas|locacoes)$/);
});
