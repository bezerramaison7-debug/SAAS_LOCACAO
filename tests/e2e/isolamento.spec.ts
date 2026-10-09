import { expect, test } from "@playwright/test";

import { arquivoSessao, CONTAS, EMPRESA_A_ID, EMPRESA_B_NOME } from "./support/usuarios";

test.describe("acesso cruzado entre empresas", () => {
  test.use({ storageState: arquivoSessao("adminB") });

  test("forjar o cookie de empresa ativa com o ID da Empresa A não dá acesso a ela", async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([{ name: "empresa_ativa", value: EMPRESA_A_ID, url: baseURL ?? "" }]);
    await page.goto("/configuracoes/usuarios");
    await expect(page.getByText(`Usuários com acesso a ${EMPRESA_B_NOME}`)).toBeVisible();
    const principal = page.getByRole("main");
    await expect(principal.getByText(CONTAS.adminB).filter({ visible: true })).toBeVisible();
    // Nem visível nem oculto no HTML: os dados da Empresa A não chegam ao navegador.
    await expect(principal.getByText(CONTAS.adminA)).toHaveCount(0);
    await expect(principal.getByText(CONTAS.comprasA)).toHaveCount(0);
  });

  test("escolher a Empresa A pelo formulário é recusado", async ({ page }) => {
    await page.goto("/selecionar-empresa");
    // Adultera o valor enviado: o servidor valida contra as associações do usuário.
    await page
      .locator('input[name="empresaId"]')
      .first()
      .evaluate((el, id) => {
        (el as HTMLInputElement).value = id;
      }, EMPRESA_A_ID);
    await page.getByRole("button", { name: /Empresa B/ }).click();
    await expect(page).toHaveURL(/\/selecionar-empresa\?erro=1$/);
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Empresa inválida");
  });
});
