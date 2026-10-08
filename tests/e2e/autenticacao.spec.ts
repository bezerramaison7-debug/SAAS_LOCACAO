import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { dispositivo } from "./helpers";
import { linkConfirmacao, ultimoEmailPara } from "./support/mailpit";
import { CONTAS, entrar, entrarComSucesso, EMPRESA_A_NOME } from "./support/usuarios";

test.describe("login e logout", () => {
  test("login válido leva ao painel e mostra usuário, papel e empresa", async ({ page }) => {
    await entrarComSucesso(page, CONTAS.comprasA);
    await expect(page.getByRole("heading", { level: 1, name: "Painel" })).toBeVisible();
    await expect(page.getByTestId("empresa-ativa").first()).toHaveText(EMPRESA_A_NOME);
  });

  test("senha incorreta mostra erro específico e mantém o e-mail", async ({ page }) => {
    await entrar(page, CONTAS.comprasA, "SenhaErrada123");
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(
      "E-mail ou senha incorretos.",
    );
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel("E-mail")).toHaveValue(CONTAS.comprasA);
  });

  test("campos inválidos mostram erros junto aos campos", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill("nao-e-email");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("Informe um e-mail válido")).toBeVisible();
    await expect(page.getByText("Informe a senha")).toBeVisible();
    await expect(page.getByLabel("E-mail")).toHaveAttribute("aria-invalid", "true");
  });

  test("logout encerra a sessão e protege as rotas novamente", async ({ page }) => {
    await entrarComSucesso(page, CONTAS.financeiroA);
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login\?saiu=1$/);
    await expect(page.getByText("Você saiu do sistema.")).toBeVisible();
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
  });

  test("rota privada sem sessão redireciona ao login e volta ao destino após entrar", async ({
    page,
  }) => {
    await page.goto("/locacoes?status=ATIVA");
    await expect(page).toHaveURL(/\/login\?next=/);
    await page.getByLabel("E-mail").fill(CONTAS.gestorA);
    await page.getByLabel("Senha", { exact: true }).fill("Demo@123456");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/locacoes\?status=ATIVA$/);
  });

  test("next externo é ignorado (sem open redirect)", async ({ page }) => {
    await page.goto("/login?next=https://malicioso.example/roubo");
    await page.getByLabel("E-mail").fill(CONTAS.gestorA);
    await page.getByLabel("Senha", { exact: true }).fill("Demo@123456");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/dashboard$/);
  });

  test("usuário autenticado que abre /login vai para o painel", async ({ page }) => {
    await entrarComSucesso(page, CONTAS.gestorA);
    await page.goto("/login");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("API privada sem sessão responde 401", async ({ request }) => {
    const r = await request.get("/api/files", { maxRedirects: 0 });
    expect(r.status()).toBe(401);
  });
});

test.describe("usuários sem acesso", () => {
  test("associação inativa: autentica, mas não acessa dados", async ({ page }) => {
    await entrar(page, CONTAS.inativoA);
    await expect(page).toHaveURL(/\/sem-acesso$/);
    await expect(page.getByRole("heading", { name: "Sem acesso a nenhuma empresa" })).toBeVisible();
    await page.goto("/configuracoes");
    await expect(page).toHaveURL(/\/sem-acesso$/);
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login\?saiu=1$/);
  });

  test("usuário sem empresa vai para 'sem acesso'", async ({ page }) => {
    await entrar(page, CONTAS.semEmpresa);
    await expect(page).toHaveURL(/\/sem-acesso$/);
  });
});

test.describe("troca de empresa", () => {
  test("usuário de duas empresas escolhe a empresa e pode trocar", async ({ page }, testInfo) => {
    await entrar(page, CONTAS.multi);
    await expect(page).toHaveURL(/\/selecionar-empresa$/);
    await page.getByRole("button", { name: /Empresa B/ }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    if (dispositivo(testInfo) !== "celular") {
      await expect(page.getByTestId("empresa-ativa")).toHaveText(/Empresa B/);
    }
    await page.getByRole("link", { name: "Trocar empresa" }).click();
    await page.getByRole("button", { name: /Empresa A/ }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/configuracoes");
    if (dispositivo(testInfo) !== "celular") {
      await expect(page.getByTestId("empresa-ativa")).toHaveText(/Empresa A/);
    }
  });
});

test.describe("recuperação de senha", () => {
  test("resposta neutra para e-mail inexistente", async ({ page }) => {
    await page.goto("/recuperar-senha");
    await page.getByLabel("E-mail").fill(`ninguem.${Date.now()}@demo.rastreio.test`);
    await page.getByRole("button", { name: "Enviar link" }).click();
    await expect(page.getByRole("main").getByRole("status")).toContainText(
      "Se o e-mail estiver cadastrado",
    );
  });

  test("fluxo completo: e-mail → link → nova senha → login com a nova senha", async ({
    page,
    browser,
  }, testInfo) => {
    test.skip(dispositivo(testInfo) !== "desktop", "Fluxo de e-mail executado uma vez (desktop)");
    const inicio = new Date(Date.now() - 1000);
    await page.goto("/recuperar-senha");
    await page.getByLabel("E-mail").fill(CONTAS.recuperacaoA);
    await page.getByRole("button", { name: "Enviar link" }).click();
    await expect(page.getByRole("main").getByRole("status")).toContainText(
      "Se o e-mail estiver cadastrado",
    );

    const email = await ultimoEmailPara(CONTAS.recuperacaoA, inicio, /Redefinição de senha/);
    // Link aberto em OUTRO navegador/contexto: token_hash não depende de PKCE.
    const contexto = await browser.newContext();
    const outra = await contexto.newPage();
    await outra.goto(linkConfirmacao(email.html));
    await expect(outra).toHaveURL(/\/recuperar-senha\/redefinir$/);
    const nova = `Nova${Date.now()}Ab`;
    await outra.getByLabel("Nova senha", { exact: true }).fill(nova);
    await outra.getByLabel("Confirme a nova senha").fill(nova);
    await outra.getByRole("button", { name: "Salvar senha e entrar" }).click();
    await expect(outra).toHaveURL(/\/dashboard$/);
    await contexto.close();

    await entrarComSucesso(page, CONTAS.recuperacaoA, nova);
  });

  test("link inválido leva ao login com aviso", async ({ page }) => {
    await page.goto("/auth/confirm?token_hash=invalido1234567890&type=recovery");
    await expect(page).toHaveURL(/\/login\?erro=link$/);
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "Link inválido ou expirado",
    );
  });

  test("redefinir senha sem sessão de recuperação é bloqueado", async ({ page }) => {
    await page.goto("/recuperar-senha/redefinir");
    await expect(page).toHaveURL(/\/login\?erro=link$/);
  });
});

test("telas públicas sem violações sérias de acessibilidade", async ({ page }) => {
  for (const rota of ["/login", "/recuperar-senha"]) {
    await page.goto(rota);
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(
      r.violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => v.id),
    ).toEqual([]);
  }
});
