/**
 * CA-82 / F9.2: fluxos críticos completáveis só com teclado (Tab, digitação,
 * Enter, Esc), com o foco sempre visível.
 */
import { expect, type Locator, type Page, test } from "@playwright/test";

import { dispositivo } from "./helpers";
import { criarAtivosRecebidos } from "./support/dados";
import { arquivoSessao, CONTAS, SENHA_DEMO } from "./support/usuarios";

/** Avança com Tab até o elemento receber o foco (falha se não chegar). */
async function focarComTab(page: Page, alvo: Locator, maximo = 60) {
  for (let i = 0; i < maximo; i++) {
    if (await alvo.evaluate((el) => el === document.activeElement)) break;
    await page.keyboard.press("Tab");
  }
  await expect(alvo).toBeFocused();
  // Foco visível (WCAG 2.4.7): contorno ou anel de foco.
  const estilo = await alvo.evaluate((el) => {
    const s = getComputedStyle(el);
    return { contorno: s.outlineStyle, sombra: s.boxShadow };
  });
  expect(estilo.contorno !== "none" || estilo.sombra !== "none", "foco visível").toBe(true);
}

test.beforeEach(({}, info) => {
  test.skip(dispositivo(info) === "celular", "Teclado físico: tablet/desktop");
});

test("login só com teclado", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();
  await page.goto("/login");
  await focarComTab(page, page.getByLabel("E-mail"));
  await page.keyboard.type(CONTAS.operacaoA);
  await focarComTab(page, page.getByLabel("Senha", { exact: true }));
  await page.keyboard.type(SENHA_DEMO);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/dashboard$/);
  await ctx.close();
});

test.describe("operação só com teclado", () => {
  test.use({ storageState: arquivoSessao("operacaoA") });

  test("registra ocorrência e a cancela pelo diálogo de confirmação (Esc fecha e devolve o foco)", async ({
    page,
  }) => {
    const { bens } = await criarAtivosRecebidos("A", `teclado-${Date.now()}`, 1, {
      loteSemChecklist: true,
    });
    const bem = bens[0];
    if (!bem) throw new Error("sem bem");
    await page.goto(`/ocorrencias/nova?bem=${bem.id}`);
    // Tipo pelo teclado: no <select> as setas mudam a opção.
    await focarComTab(page, page.getByLabel("Tipo"));
    await page.keyboard.press("ArrowDown");
    await expect(page.getByLabel("Tipo")).toHaveValue("DEFEITO");
    await focarComTab(page, page.getByLabel("Descrição"));
    await page.keyboard.type("Display apagado ao ligar");
    const enviar = page.getByRole("button", { name: "Registrar ocorrência" });
    await focarComTab(page, enviar);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/ocorrencias\/[0-9a-f-]{36}/);

    const cancelar = page.getByRole("button", { name: "Cancelar ocorrência" });
    await focarComTab(page, cancelar);
    await page.keyboard.press("Enter");
    const dialogo = page.getByRole("alertdialog");
    await expect(dialogo).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialogo).toBeHidden();
    await expect(cancelar).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(dialogo).toBeVisible();
    await focarComTab(page, dialogo.getByLabel("Motivo do cancelamento"));
    await page.keyboard.type("Registrada por engano no bem errado");
    await focarComTab(page, dialogo.getByRole("button", { name: "Cancelar ocorrência" }));
    await page.keyboard.press("Enter");
    await expect(page.getByText("Ocorrência cancelada.")).toBeVisible();
  });

  test("movimentação só com teclado", async ({ page }) => {
    const { bens } = await criarAtivosRecebidos("A", `teclado-mov-${Date.now()}`, 1, {
      loteSemChecklist: true,
    });
    const bem = bens[0];
    if (!bem) throw new Error("sem bem");
    await page.goto(`/movimentacoes/nova?bem=${bem.id}`);
    const destino = page.getByLabel("Local de destino");
    await focarComTab(page, destino);
    // O destino inicial é o local atual; a seta escolhe outro.
    const antes = await destino.inputValue();
    await page.keyboard.press("ArrowDown");
    expect(await destino.inputValue()).not.toBe(antes);
    await focarComTab(page, page.getByLabel("Motivo"));
    await page.keyboard.type("Envio para a frente de serviço");
    await focarComTab(page, page.getByRole("button", { name: "Registrar movimentação" }));
    await page.keyboard.press("Enter");
    await expect(page.getByText("Movimentação registrada.")).toBeVisible();
  });
});
