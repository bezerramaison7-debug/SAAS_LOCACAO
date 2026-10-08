import { expect, type Locator, type Page, test } from "@playwright/test";

import { larguraExcedente } from "./helpers";
import { arquivoSessao } from "./support/usuarios";

function unico(prefixo: string, projeto: string): string {
  return `${prefixo}-${projeto.replace(/\W/g, "").slice(-4)}-${Date.now().toString(36)}`.toUpperCase();
}

const main = (page: Page) => page.locator("main");
const visivel = (locator: Locator) => locator.filter({ visible: true }).first();

async function confirmar(page: Page, rotuloBotao: string, rotuloConfirmar: string) {
  await main(page).getByRole("button", { name: rotuloBotao }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: rotuloConfirmar }).click();
}

test.describe("Operação", () => {
  test.use({ storageState: arquivoSessao("operacaoA") });

  test("cadastra local, rejeita código duplicado e inativa sem excluir", async ({
    page,
  }, testInfo) => {
    const codigo = unico("OBRA", testInfo.project.name);
    await page.goto("/cadastros/locais/novo");
    await page.getByLabel("Código").fill(codigo.toLowerCase());
    await page.getByLabel("Nome").fill(`[E2E] Obra ${codigo}`);
    await page.getByLabel("Tipo").selectOption("OBRA");
    await page.getByRole("button", { name: "Cadastrar local" }).click();
    await expect(page.getByText("Local salvo.")).toBeVisible();

    // Código é normalizado para maiúsculas e é único na empresa.
    await page.goto("/cadastros/locais/novo");
    await page.getByLabel("Código").fill(codigo);
    await page.getByLabel("Nome").fill("Duplicado");
    await page.getByRole("button", { name: "Cadastrar local" }).click();
    await expect(page.getByText("Já existe local com este código.")).toBeVisible();

    await page.goto(`/cadastros/locais?q=${codigo}`);
    await visivel(main(page).getByRole("link", { name: `[E2E] Obra ${codigo}` })).click();
    await expect(page).toHaveURL(/\/cadastros\/locais\/[0-9a-f-]{36}$/);
    await expect(main(page).getByText(codigo, { exact: true })).toBeVisible();
    await page.getByLabel("Ativo").uncheck();
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText("Local salvo.")).toBeVisible();

    await page.goto(`/cadastros/locais?q=${codigo}`);
    await expect(visivel(main(page).getByText("Nenhum local encontrado"))).toBeVisible();
    await page.goto(`/cadastros/locais?q=${codigo}&situacao=inativos`);
    await expect(visivel(main(page).getByText("Inativo", { exact: true }))).toBeVisible();
  });

  test("não gerencia fornecedores (sem botão e 404 no formulário)", async ({ page }) => {
    await page.goto("/cadastros/fornecedores");
    await expect(visivel(main(page).getByText("TopoLoc"))).toBeVisible();
    await expect(page.getByRole("link", { name: "Novo fornecedor" })).toHaveCount(0);
    await page.goto("/cadastros/fornecedores/novo");
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  });

  test("checklist: cria rascunho, inclui perguntas, publica e gera nova versão", async ({
    page,
  }, testInfo) => {
    const nome = `[E2E] Checklist ${unico("CK", testInfo.project.name)}`;
    await page.goto("/cadastros/checklists/novo");
    await page.getByLabel("Nome do checklist").fill(nome);
    await page.getByRole("button", { name: "Criar rascunho" }).click();
    await expect(page.getByRole("heading", { level: 1, name: `${nome} — v1` })).toBeVisible();
    await expect(page.getByText("Adicione ao menos uma pergunta para publicar.")).toBeVisible();

    // Publicar sem perguntas é bloqueado pelo banco.
    await confirmar(page, "Publicar versão", "Publicar");
    await expect(page.getByText("Inclua ao menos uma pergunta antes de publicar")).toBeVisible();

    await page.getByRole("link", { name: "Adicionar pergunta" }).click();
    await page.getByLabel("Pergunta", { exact: true }).fill("Acessórios presentes?");
    await page.getByLabel("Tipo de resposta").selectOption("OPCAO_UNICA");
    await page.getByLabel("Opções (uma por linha)").fill("Completos\nIncompletos");
    await page.getByLabel("Exigir foto").selectOption("RESPOSTAS");
    await page.getByRole("checkbox", { name: "Incompletos" }).check();
    await page.getByRole("button", { name: "Adicionar pergunta" }).click();
    await expect(page.getByText("Pergunta salva.")).toBeVisible();
    await expect(page.getByText("Foto quando: Incompletos")).toBeVisible();

    await confirmar(page, "Publicar versão", "Publicar");
    await expect(page.getByText("Versão publicada.")).toBeVisible();
    await expect(main(page).getByRole("link", { name: "Editar pergunta 1" })).toHaveCount(0);

    await confirmar(page, "Criar nova versão", "Criar rascunho");
    await expect(page.getByRole("heading", { level: 1, name: `${nome} — v2` })).toBeVisible();
    await expect(page.getByText("Acessórios presentes?")).toBeVisible();
    await expect(page.getByRole("link", { name: "v1" })).toBeVisible();
    expect(await larguraExcedente(page)).toBeLessThanOrEqual(0);
  });
});

test.describe("Compras", () => {
  test.use({ storageState: arquivoSessao("comprasA") });

  test("categoria por lote não oferece identificação individual e o modo fica fixo", async ({
    page,
  }, testInfo) => {
    const nome = `[E2E] Escora ${unico("C", testInfo.project.name)}`;
    await page.goto("/cadastros/categorias/nova");
    await page.getByLabel("Nome").fill(nome);
    await expect(page.getByLabel("Exigir placa")).toBeVisible();
    await page.getByRole("radio", { name: /Lote/ }).check();
    await expect(page.getByLabel("Exigir placa")).toHaveCount(0);
    await page.getByLabel("Unidade padrão").fill("peça");
    await page.getByRole("button", { name: "Cadastrar categoria" }).click();
    await expect(page.getByText("Categoria salva.")).toBeVisible();

    await page.goto(`/cadastros/categorias?q=${encodeURIComponent(nome)}`);
    await visivel(main(page).getByRole("link", { name: nome })).click();
    await expect(page.getByText(/definido na criação; não pode ser alterado/)).toBeVisible();
    await expect(main(page).getByRole("radio")).toHaveCount(0);
  });

  test("centro de custo: cadastra e encontra pela busca", async ({ page }, testInfo) => {
    const codigo = unico("CC", testInfo.project.name);
    await page.goto("/cadastros/centros-custo/novo");
    await page.getByLabel("Código").fill(codigo);
    await page.getByLabel("Nome").fill("[E2E] Centro de teste");
    await page.getByRole("button", { name: "Cadastrar centro de custo" }).click();
    await expect(page.getByText("Centro de custo salvo.")).toBeVisible();
    await page.getByLabel("Buscar por código ou nome").fill(codigo);
    await page.getByRole("button", { name: "Filtrar" }).click();
    await expect(page).toHaveURL(new RegExp(`q=${codigo}`));
    await expect(visivel(main(page).getByRole("link", { name: codigo }))).toBeVisible();
  });

  test("checklists: consulta sem poder criar", async ({ page }) => {
    await page.goto("/cadastros/checklists");
    await expect(visivel(main(page).getByText("[DEMO] Inspeção de equipamento"))).toBeVisible();
    await expect(page.getByRole("link", { name: "Novo checklist" })).toHaveCount(0);
  });
});

test.describe("Responsável local", () => {
  test.use({ storageState: arquivoSessao("responsavelA") });

  test("não acessa cadastros", async ({ page }) => {
    await page.goto("/cadastros");
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  });
});
