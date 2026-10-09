import { expect, test } from "@playwright/test";

import { dispositivo } from "./helpers";
import { linkConfirmacao, ultimoEmailPara } from "./support/mailpit";
import { arquivoSessao, CONTAS, entrar, EMPRESA_A_NOME } from "./support/usuarios";

test.describe("administração de usuários (ADMIN)", () => {
  test.describe.configure({ mode: "serial" });
  test.use({ storageState: arquivoSessao("adminA") });

  test("convite → criação de senha → acesso; papel alterado; desativação bloqueia o acesso", async ({
    page,
    browser,
  }, testInfo) => {
    test.skip(dispositivo(testInfo) !== "desktop", "Fluxo de e-mail executado uma vez (desktop)");
    const email = `convidado.${Date.now()}@demo.rastreio.test`;
    const inicio = new Date(Date.now() - 1000);

    await page.goto("/configuracoes/usuarios");
    const convite = page.getByRole("form", { name: "Convidar usuário" });
    await convite.getByLabel("Nome").fill("Convidado E2E");
    await convite.getByLabel("E-mail").fill(email);
    await convite.getByLabel("Papel").selectOption("OPERACAO");
    await convite.getByRole("button", { name: "Enviar convite" }).click();
    await expect(convite.getByRole("status")).toContainText(`Convite enviado para ${email}`);
    await expect(page.getByRole("table").getByText(email)).toBeVisible();

    // O convidado cria a senha pelo link do e-mail, em outro navegador.
    const mensagem = await ultimoEmailPara(email, inicio, /Convite/);
    const ctxConvidado = await browser.newContext();
    const convidado = await ctxConvidado.newPage();
    await convidado.goto(linkConfirmacao(mensagem.html));
    await expect(convidado).toHaveURL(/\/recuperar-senha\/redefinir\?convite=1$/);
    await expect(convidado.getByRole("heading", { name: "Crie sua senha" })).toBeVisible();
    const senha = `Convite${Date.now()}A`;
    await convidado.getByLabel("Nova senha", { exact: true }).fill(senha);
    await convidado.getByLabel("Confirme a nova senha").fill(senha);
    await convidado.getByRole("button", { name: "Salvar senha e entrar" }).click();
    await expect(convidado).toHaveURL(/\/dashboard$/);
    await expect(convidado.getByTestId("empresa-ativa")).toHaveText(EMPRESA_A_NOME);

    // ADMIN altera o papel para GESTOR.
    await page.reload();
    const linha = page.getByRole("row").filter({ hasText: email });
    await linha.getByLabel(/Papel de Convidado E2E/).selectOption("GESTOR");
    await linha.getByRole("button", { name: "Salvar papel de Convidado E2E" }).click();
    await expect(linha.getByRole("status")).toHaveText("Papel alterado para Gestor.");

    // ADMIN desativa (com motivo); o convidado perde o acesso.
    await linha.getByRole("button", { name: "Desativar Convidado E2E" }).click();
    const dialogo = page.getByRole("dialog");
    await dialogo.getByRole("button", { name: "Confirmar" }).click();
    await expect(dialogo.getByText(/pelo menos 10 caracteres/)).toBeVisible();
    await dialogo.getByLabel("Motivo").fill("Teste automatizado de desativação");
    await dialogo.getByRole("button", { name: "Confirmar" }).click();
    await expect(dialogo).toBeHidden();
    await expect(
      page.getByRole("row").filter({ hasText: email }).getByText("Inativo"),
    ).toBeVisible();

    await convidado.goto("/configuracoes");
    await expect(convidado).toHaveURL(/\/sem-acesso$/);

    // Reativação devolve o acesso.
    await page
      .getByRole("row")
      .filter({ hasText: email })
      .getByRole("button", { name: "Reativar Convidado E2E" })
      .click();
    await page.getByRole("dialog").getByLabel("Motivo").fill("Reativação no teste automatizado");
    await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByRole("row").filter({ hasText: email }).getByText("Ativo")).toBeVisible();
    await convidado.goto("/dashboard");
    await expect(convidado).toHaveURL(/\/dashboard$/);
    await ctxConvidado.close();
  });

  test("lista de usuários: nenhum controle ultrapassa seu cartão/célula nem a janela", async ({
    page,
  }) => {
    await page.goto("/configuracoes/usuarios");
    await expect(page.getByRole("heading", { level: 1, name: "Usuários e papéis" })).toBeVisible();
    const estourados = await page.getByRole("main").evaluate((main) => {
      const largura = document.documentElement.clientWidth;
      return [...main.querySelectorAll("button, select, input, a")]
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .filter((el) => {
          const direita = el.getBoundingClientRect().right;
          const caixa = el.closest("li, td")?.getBoundingClientRect();
          return direita > largura + 1 || (caixa !== undefined && direita > caixa.right + 1);
        })
        .map((el) => el.outerHTML.slice(0, 80));
    });
    expect(estourados).toEqual([]);
  });

  test("ADMIN não vê opção de desativar a si mesmo", async ({ page }) => {
    await page.goto("/configuracoes/usuarios");
    const propria = page
      .getByRole("main")
      .locator("tr, li")
      .filter({ hasText: CONTAS.adminA })
      .filter({ visible: true });
    await expect(propria.getByText("Você")).toBeVisible();
    await expect(propria.getByRole("button", { name: /Desativar/ })).toHaveCount(0);
  });

  test("convite com dados inválidos mostra erros nos campos", async ({ page }) => {
    await page.goto("/configuracoes/usuarios");
    const convite = page.getByRole("form", { name: "Convidar usuário" });
    await convite.getByLabel("E-mail").fill("invalido");
    await convite.getByRole("button", { name: "Enviar convite" }).click();
    await expect(convite.getByText("Informe um e-mail válido")).toBeVisible();
    await expect(convite.getByText("Informe o nome")).toBeVisible();
  });

  test("vincular quem já é membro é rejeitado com mensagem clara", async ({ page }) => {
    await page.goto("/configuracoes/usuarios");
    const convite = page.getByRole("form", { name: "Convidar usuário" });
    await convite.getByLabel("Nome").fill("Duplicado");
    await convite.getByLabel("E-mail").fill(CONTAS.comprasA);
    await convite.getByRole("button", { name: "Enviar convite" }).click();
    await expect(convite.getByRole("alert")).toHaveText("Usuário já está associado a esta empresa");
  });
});

test.describe("contas desativadas não entram mesmo com senha correta", () => {
  test("inativo não acessa dados", async ({ page }) => {
    await entrar(page, CONTAS.inativoA);
    await expect(page).toHaveURL(/\/sem-acesso$/);
  });
});
