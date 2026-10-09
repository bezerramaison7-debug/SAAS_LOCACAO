import { expect, type Locator, type Page, test } from "@playwright/test";

import { A, B } from "../support/fixtures";
import { larguraExcedente } from "./helpers";
import { arquivoSessao } from "./support/usuarios";

/** Identificador único por execução/projeto (os testes gravam dados reais). */
function unico(prefixo: string, projeto: string): string {
  return `${prefixo}-${projeto.replace(/\W/g, "").slice(-6)}-${Date.now().toString(36)}`.toUpperCase();
}

const main = (page: Page) => page.locator("main");

/** A tabela vira cartões no celular: o mesmo texto existe nas duas formas, uma oculta. */
const visivel = (locator: Locator) => locator.filter({ visible: true }).first();
const abas = (page: Page) => page.getByRole("navigation", { name: "Seções da locação" });

async function confirmar(page: Page, rotuloBotao: string | RegExp, rotuloConfirmar: string) {
  await main(page).getByRole("button", { name: rotuloBotao }).click();
  const dialogo = page.getByRole("alertdialog");
  await expect(dialogo).toBeVisible();
  await dialogo.getByRole("button", { name: rotuloConfirmar }).click();
}

test.describe("Compras", () => {
  test.use({ storageState: arquivoSessao("comprasA") });

  test("GATE: cadastra fornecedor, cria e ativa locação completa com item individual e lote", async ({
    page,
  }, testInfo) => {
    const fornecedor = `[E2E] Locadora ${unico("F", testInfo.project.name)}`;
    const pedido = unico("PC", testInfo.project.name);

    // 1) Fornecedor novo
    await page.goto("/cadastros/fornecedores/novo");
    await page.getByLabel("Razão social").fill(fornecedor);
    await page.getByLabel("Nome fantasia").fill(fornecedor);
    await page.getByRole("button", { name: "Cadastrar fornecedor" }).click();
    await expect(page.getByText("Fornecedor salvo.")).toBeVisible();

    // 2) Identificação
    await page.goto("/locacoes/nova");
    await expect(page.getByRole("heading", { level: 1, name: "Nova locação" })).toBeVisible();
    await page.getByLabel("Fornecedor").selectOption({ label: `${fornecedor} — ${fornecedor}` });
    await page
      .getByLabel("Centro de custo")
      .selectOption({ label: "CC-1001 — [DEMO] Obras Residenciais" });
    await page.getByRole("button", { name: "Criar rascunho e continuar" }).click();
    await expect(page).toHaveURL(/\/locacoes\/[0-9a-f-]{36}\/editar\?etapa=referencias$/);
    const id = page.url().match(/locacoes\/([0-9a-f-]{36})/)?.[1];
    expect(id).toBeTruthy();

    // 3) Referência manual do Sectra
    await page.getByLabel("Número do documento").fill(pedido);
    await page.getByRole("button", { name: "Vincular documento" }).click();
    await expect(visivel(main(page).getByText(pedido))).toBeVisible();
    await page.getByRole("link", { name: /Continuar: Itens/ }).click();

    // 4) Item individual + item por lote
    await page.getByLabel("Categoria").selectOption({ label: "Estação total — individual" });
    await page.getByLabel("Descrição do item").fill("Estação total E2E");
    await page.getByLabel("Quantidade contratada").fill("2");
    await page.getByLabel("Valor unitário (R$)").fill("1.234,56");
    await page.getByRole("button", { name: "Adicionar item" }).click();
    await expect(page.getByText("Item salvo.")).toBeVisible();

    await page.getByLabel("Categoria").selectOption({ label: "Andaime tubular — lote" });
    await expect(page.getByLabel("Unidade")).toHaveValue("peça");
    await page.getByLabel("Descrição do item").fill("Andaime E2E");
    await page.getByLabel("Quantidade contratada").fill("10,5");
    await page.getByLabel("Valor unitário (R$)").fill("3,50");
    await page.getByLabel("Periodicidade da cobrança").selectOption("DIARIA");
    await page.getByRole("button", { name: "Adicionar item" }).click();
    await expect(visivel(main(page).getByText("Andaime E2E"))).toBeVisible();
    await expect(visivel(main(page).getByText("R$ 1.234,56 / mensal"))).toBeVisible();
    await expect(visivel(main(page).getByText("10,5 peça"))).toBeVisible();
    await page.getByRole("link", { name: /Continuar: Vigência/ }).click();

    // 5) Vigência
    await page.getByLabel("Início previsto").fill("2026-11-01");
    await page.getByLabel("Término previsto").fill("2027-04-30");
    await page.getByRole("button", { name: "Salvar e revisar" }).click();

    // 6) Revisão e ativação
    await expect(page.getByText("Locação completa. Pronta para ativar.")).toBeVisible();
    expect(await larguraExcedente(page)).toBeLessThanOrEqual(0);
    await confirmar(page, "Ativar locação", "Ativar");
    await expect(page).toHaveURL(new RegExp(`/locacoes/${id}\\?ativada=1$`));
    await expect(page.getByText("Locação ativada.")).toBeVisible();
    await expect(visivel(main(page).getByText("Ativa", { exact: true }))).toBeVisible();

    // 7) Persistência real: encontrada na lista pelo número do pedido
    await page.goto(`/locacoes?q=${pedido}`);
    await expect(page.getByText("1 locação encontrada")).toBeVisible();
    await expect(visivel(main(page).getByText(pedido))).toBeVisible();
    await expect(visivel(main(page).getByText("Ativa", { exact: true }))).toBeVisible();

    // 8) Editar não é mais possível após a ativação
    await page.goto(`/locacoes/${id}/editar?etapa=itens`);
    await expect(page).toHaveURL(new RegExp(`/locacoes/${id}$`));
  });

  test("rascunho incompleto mostra pendências e não oferece ativação", async ({ page }) => {
    await page.goto(`/locacoes/${A.locacaoRascunho}/editar?etapa=revisao`);
    await expect(page.getByText("Ainda falta completar:")).toBeVisible();
    await expect(page.getByText("Vincule o pedido do Sectra")).toBeVisible();
    await expect(main(page).getByRole("button", { name: "Ativar locação" })).toHaveCount(0);
  });

  test("valida campos no servidor e mantém o que foi digitado", async ({ page }) => {
    await page.goto(`/locacoes/${A.locacaoRascunho}/editar?etapa=itens`);
    await page.getByLabel("Categoria").selectOption({ label: "Estação total — individual" });
    await page.getByLabel("Descrição do item").fill("Item inválido");
    await page.getByLabel("Quantidade contratada").fill("1,5");
    await page.getByLabel("Valor unitário (R$)").fill("abc");
    await page.getByRole("button", { name: "Adicionar item" }).click();
    await expect(page.getByText("Controle individual exige quantidade inteira")).toBeVisible();
    await expect(page.getByText("Informe um valor válido (ex.: 1.234,56)")).toBeVisible();
    await expect(page.getByLabel("Descrição do item")).toHaveValue("Item inválido");
  });

  test("cancela uma locação em rascunho exigindo motivo", async ({ page }) => {
    await page.goto("/locacoes/nova");
    await page.getByLabel("Fornecedor").selectOption({ index: 1 });
    await page.getByLabel("Centro de custo").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Criar rascunho e continuar" }).click();
    await expect(page).toHaveURL(/editar\?etapa=referencias$/);
    const id = page.url().match(/locacoes\/([0-9a-f-]{36})/)?.[1];
    await page.goto(`/locacoes/${id}`);
    await main(page).getByRole("button", { name: "Cancelar locação" }).click();
    const dialogo = page.getByRole("alertdialog");
    const confirmarBotao = dialogo.getByRole("button", { name: "Cancelar locação" });
    await expect(confirmarBotao).toBeDisabled();
    await dialogo
      .getByLabel("Motivo do cancelamento")
      .fill("Pedido cancelado no Sectra pela diretoria");
    await confirmarBotao.click();
    await expect(page).toHaveURL(new RegExp(`/locacoes/${id}\\?cancelada=1$`));
    await expect(visivel(main(page).getByText("Cancelada", { exact: true }))).toBeVisible();
    await expect(
      visivel(main(page).getByText("Pedido cancelado no Sectra pela diretoria")),
    ).toBeVisible();
    await expect(main(page).getByRole("button", { name: "Cancelar locação" })).toHaveCount(0);
  });

  test("filtros e paginação ficam na URL", async ({ page }) => {
    await page.goto("/locacoes?status=EM_DEVOLUCAO&tamanho=50");
    await expect(page.getByRole("checkbox", { name: "Em devolução" })).toBeChecked();
    await expect(visivel(main(page).getByText("4500012399"))).toBeVisible();
    await expect(main(page).getByText("4500012345")).toHaveCount(0);

    await page.getByRole("checkbox", { name: "Em devolução" }).uncheck();
    await page.getByRole("checkbox", { name: "Ativa", exact: true }).check();
    // Busca pelo prefixo dos pedidos do seed: as locações ativas criadas pelos testes não o usam.
    await page.getByLabel(/^Buscar por código/).fill("45000123");
    await page.getByRole("button", { name: "Filtrar" }).click();
    await expect(page).toHaveURL(/status=ATIVA/);
    await expect(page).toHaveURL(/tamanho=50/);
    await expect(page).toHaveURL(/q=45000123/);
    await expect(visivel(main(page).getByText("4500012345"))).toBeVisible();
    await expect(main(page).getByText("4500012399")).toHaveCount(0);

    await page.goto("/locacoes?q=sem-resultado-xyz");
    await expect(page.getByText("Nenhuma locação encontrada")).toBeVisible();
    await page.getByRole("link", { name: "Limpar" }).click();
    await expect(page).toHaveURL(/\/locacoes$/);
  });

  test("não vê o histórico (auditoria) nem acessa locação de outra empresa", async ({ page }) => {
    await page.goto(`/locacoes/${A.locacaoAtiva}?aba=historico`);
    await expect(abas(page).getByRole("link", { name: "Histórico" })).toHaveCount(0);
    await expect(abas(page).getByRole("link", { name: "Resumo" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await page.goto(`/locacoes/${B.locacaoAtiva}`);
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  });
});

test.describe("Operação", () => {
  test.use({ storageState: arquivoSessao("operacaoA") });

  test("consulta locações mas não cria nem edita", async ({ page }) => {
    await page.goto("/locacoes");
    await expect(page.getByRole("heading", { level: 1, name: "Locações" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Nova locação" })).toHaveCount(0);
    await page.goto("/locacoes/nova");
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
    await page.goto(`/locacoes/${A.locacaoRascunho}/editar`);
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
    await page.goto(`/locacoes/${A.locacaoRascunho}`);
    await expect(page.getByRole("link", { name: "Continuar preenchimento" })).toHaveCount(0);
    await expect(main(page).getByRole("button", { name: "Cancelar locação" })).toHaveCount(0);
  });
});

test.describe("Administrador", () => {
  test.use({ storageState: arquivoSessao("adminA") });

  test("detalhe exibe todas as abas com dados reais e sem estourar a largura", async ({ page }) => {
    await page.goto(`/locacoes/${A.locacaoAtiva}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Locação");
    for (const aba of [
      "Resumo",
      "Itens",
      "Recebimentos",
      "Bens e lotes",
      "Movimentações",
      "Documentos",
      "Devoluções",
      "Cobranças",
      "Histórico",
    ]) {
      await abas(page).getByRole("link", { name: aba, exact: true }).click();
      await expect(abas(page).getByRole("link", { name: aba, exact: true })).toHaveAttribute(
        "aria-current",
        "page",
      );
      await expect(page.getByText("Não foi possível carregar esta tela")).toHaveCount(0);
      expect(await larguraExcedente(page), aba).toBeLessThanOrEqual(0);
    }
    await abas(page).getByRole("link", { name: "Itens", exact: true }).click();
    await expect(visivel(main(page).getByText("Estação total Leica TS07"))).toBeVisible();
    await expect(visivel(main(page).getByText("R$ 2.800,00 / mensal"))).toBeVisible();
  });
});

test.describe("Responsável local", () => {
  test.use({ storageState: arquivoSessao("responsavelA") });

  test("não vê valores nem a criação de locações", async ({ page }) => {
    await page.goto("/locacoes");
    await expect(page.getByRole("link", { name: "Nova locação" })).toHaveCount(0);
    await page.goto(`/locacoes/${A.locacaoAtiva}?aba=itens`);
    await expect(page.getByText(/R\$/)).toHaveCount(0);
    await expect(abas(page).getByRole("link", { name: "Itens", exact: true })).toHaveCount(0);
  });
});
