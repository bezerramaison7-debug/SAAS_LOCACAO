import { expect, test } from "@playwright/test";

import { dispositivo } from "./helpers";
import { arquivoSessao, CONTAS_COM_SESSAO } from "./support/usuarios";

/** O que cada perfil vê/pode fazer (UX). O servidor e o banco revalidam (testes RLS/integração). */
const ESPERADO: Record<
  (typeof CONTAS_COM_SESSAO)[number],
  { usuarios: boolean; empresa: boolean; cobrancas: boolean }
> = {
  adminA: { usuarios: true, empresa: true, cobrancas: true },
  comprasA: { usuarios: false, empresa: false, cobrancas: true },
  operacaoA: { usuarios: false, empresa: false, cobrancas: true },
  responsavelA: { usuarios: false, empresa: false, cobrancas: false },
  financeiroA: { usuarios: false, empresa: false, cobrancas: true },
  gestorA: { usuarios: false, empresa: false, cobrancas: true },
  auditorA: { usuarios: false, empresa: false, cobrancas: true },
  adminB: { usuarios: true, empresa: true, cobrancas: true },
};

for (const conta of CONTAS_COM_SESSAO) {
  test.describe(`perfil ${conta}`, () => {
    test.use({ storageState: arquivoSessao(conta) });
    const esperado = ESPERADO[conta];

    test("gestão de usuários: acesso somente para ADMIN (demais recebem 404)", async ({ page }) => {
      // Com streaming (loading.tsx) o 404 chega como página "não encontrada" (D-37).
      await page.goto("/configuracoes/usuarios");
      if (esperado.usuarios) {
        await expect(
          page.getByRole("heading", { level: 1, name: "Usuários e papéis" }),
        ).toBeVisible();
        await expect(page.getByRole("button", { name: "Enviar convite" })).toBeVisible();
      } else {
        await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Enviar convite" })).toHaveCount(0);
        await expect(page.getByText("@demo.rastreio.test")).toHaveCount(0);
      }
    });

    test("configurações exibem apenas as seções permitidas", async ({ page }) => {
      await page.goto("/configuracoes");
      await expect(page.getByRole("heading", { name: "Meu perfil" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Empresa", exact: true })).toHaveCount(
        esperado.empresa ? 1 : 0,
      );
      await expect(page.getByRole("link", { name: /Usuários e papéis/ })).toHaveCount(
        esperado.usuarios ? 1 : 0,
      );
    });

    test("menu exibe Cobranças apenas para quem vê valores", async ({ page }, testInfo) => {
      await page.goto("/dashboard");
      if (dispositivo(testInfo) !== "desktop")
        await page.getByRole("button", { name: "Mais" }).click();
      const menu =
        dispositivo(testInfo) === "desktop"
          ? page.locator("aside")
          : page.getByRole("dialog", { name: "Menu" });
      await expect(menu.getByRole("link", { name: "Cobranças" })).toHaveCount(
        esperado.cobrancas ? 1 : 0,
      );
    });
  });
}

test.describe("perfil edita o próprio cadastro", () => {
  test.use({ storageState: arquivoSessao("operacaoA") });

  test("altera telefone do próprio perfil", async ({ page }) => {
    await page.goto("/configuracoes");
    const telefone = `(11) 9${String(Date.now()).slice(-4)}-0000`;
    await page.getByLabel("Telefone").fill(telefone);
    await page.getByRole("button", { name: "Salvar perfil" }).click();
    await expect(page.getByRole("status")).toHaveText("Perfil atualizado.");
    await page.reload();
    await expect(page.getByLabel("Telefone")).toHaveValue(telefone);
  });
});
