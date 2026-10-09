import { expect, type Locator, type Page, test } from "@playwright/test";

import { anexar, dispositivo, larguraExcedente } from "./helpers";
import { A } from "../support/fixtures";
import { criarLocacaoAtiva, JPEG_TESTE } from "./support/dados";
import { arquivoSessao } from "./support/usuarios";

const main = (page: Page) => page.locator("main");
const visivel = (l: Locator) => l.filter({ visible: true }).first();
const foto = (nome = "foto.jpg") => ({ name: nome, mimeType: "image/jpeg", buffer: JPEG_TESTE });

async function semEstouro(page: Page, etapa: string) {
  expect(await larguraExcedente(page), etapa).toBeLessThanOrEqual(0);
}

async function confirmarDialogo(
  page: Page,
  botao: string | RegExp,
  confirmar: string,
  motivo?: string,
) {
  await main(page).getByRole("button", { name: botao }).click();
  const dialogo = page.getByRole("alertdialog");
  if (motivo) await dialogo.getByRole("textbox").fill(motivo);
  await dialogo.getByRole("button", { name: confirmar }).click();
}

async function iniciarRecebimento(page: Page, locacaoId: string) {
  await page.goto(`/recebimentos/novo?locacao=${locacaoId}`);
  await page.getByRole("button", { name: "Iniciar recebimento" }).click();
  await expect(page).toHaveURL(/\/recebimentos\/[0-9a-f-]{36}\?etapa=itens$/);
  return page.url().match(/recebimentos\/([0-9a-f-]{36})/)?.[1] as string;
}

async function responderVistoria(page: Page) {
  const regiao = page.getByRole("region", { name: /^Vistoria de / });
  // Foto exigida pela pergunta 1 (SEMPRE) antes das respostas.
  await anexar(regiao.getByLabel("Foto desta pergunta").first(), foto("pergunta1.jpg"));
  await expect(regiao.getByText("Arquivo enviado.").first()).toBeVisible();
  await expect(regiao.locator("img").first()).toBeVisible();
  await regiao.getByRole("radio", { name: "Conforme", exact: true }).check();
  await regiao.getByRole("radio", { name: "Sim", exact: true }).check();
  await regiao.getByRole("radio", { name: "Completos", exact: true }).check();
  await regiao.getByRole("button", { name: "Salvar respostas" }).click();
  await expect(regiao.getByText("Respostas salvas.")).toBeVisible();
}

test.describe("Operação — recebimento completo (gate da Fase 5)", () => {
  test.use({ storageState: arquivoSessao("operacaoA") });

  test("recebe bem individual avariado e lote, com fotos e checklist, e confirma", async ({
    page,
    browser,
  }, testInfo) => {
    test.slow();
    const locacao = await criarLocacaoAtiva(`gate ${testInfo.project.name} ${Date.now()}`);
    const serie = `E2E-${Date.now().toString(36).toUpperCase()}`;
    const id = await iniciarRecebimento(page, locacao.id);
    await semEstouro(page, "itens");

    // Etapa 2 — itens: unidade individual (série exigida) e quantidade do lote.
    const individual = page.getByRole("form", { name: "Incluir unidade de Estação total E2E" });
    await individual.getByRole("button", { name: "Incluir unidade" }).click();
    await expect(individual.getByText("Informe o número de série")).toBeVisible();
    await individual.getByLabel("Número de série").fill(serie);
    await individual.getByLabel("Condição").selectOption("AVARIADO");
    await individual.getByLabel("Observação").fill("Visor riscado na chegada");
    await individual.getByRole("button", { name: "Incluir unidade" }).click();
    await expect(page.getByText("Unidade incluída.")).toBeVisible();
    await expect(
      main(page)
        .getByText(new RegExp(`BEM-\\d+ \\(${serie}\\)`))
        .first(),
    ).toBeVisible();

    const lote = page.getByRole("form", { name: "Quantidade recebida de Andaime E2E" });
    await lote.getByLabel("Quantidade recebida (peça)").fill("12,5");
    await lote.getByRole("button", { name: "Registrar quantidade" }).click();
    await expect(page.getByText("Quantidade registrada.")).toBeVisible();

    // Etapa 3 — fotos (câmera no celular via capture).
    await page.getByRole("link", { name: /Continuar: Fotos/ }).click();
    const fotosBem = page.getByRole("region", {
      name: new RegExp(`Fotos de BEM-\\d+ \\(${serie}\\)`),
    });
    await expect(fotosBem.getByText("Avariado — foto obrigatória")).toBeVisible();
    const campo = fotosBem.getByLabel("Tirar foto");
    await expect(campo).toHaveAttribute("capture", "environment");
    await anexar(campo, foto("avaria.jpg"));
    await expect(fotosBem.locator("img")).toBeVisible();
    // A miniatura carrega de fato (URL assinada aceita pela CSP e imagem decodificada).
    await expect
      .poll(() =>
        fotosBem.locator("img").evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0),
      )
      .toBe(true);
    await semEstouro(page, "fotos");

    // Arquivo que não é imagem é recusado pelo conteúdo, não pela extensão.
    await anexar(fotosBem.getByLabel("Tirar foto"), {
      name: "falsa.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("<html>"),
    });
    await expect(
      fotosBem.getByText("Formato não aceito. Envie JPG, PNG, WEBP ou PDF."),
    ).toBeVisible();

    // Etapa 4 — checklist de entrada (versão vigente) para cada item.
    await page.getByRole("link", { name: /Continuar: Checklist/ }).click();
    for (const item of [serie, "Andaime E2E"]) {
      await main(page).getByRole("button", { name: "Fazer vistoria" }).first().click();
      await expect(
        page.getByRole("region", { name: new RegExp(`^Vistoria de .*${item}`) }),
      ).toBeVisible();
      await responderVistoria(page);
    }
    await semEstouro(page, "checklist");

    // Etapa 5 — local e responsável.
    await page.getByRole("link", { name: /Continuar: Local e responsável/ }).click();
    await page
      .getByLabel("Local onde ficarão")
      .selectOption({ label: "[DEMO] Obra Residencial Norte (OBRA-001)" });
    await page.getByRole("button", { name: "Salvar e revisar" }).click();

    // Etapa 6 — revisão e confirmação transacional.
    await expect(page.getByText("Tudo pronto para confirmar.")).toBeVisible();
    await semEstouro(page, "revisao");
    await confirmarDialogo(page, "Confirmar recebimento", "Confirmar");
    await expect(page).toHaveURL(new RegExp(`/recebimentos/${id}\\?confirmado=1$`));
    await expect(page.getByText("Recebimento confirmado.")).toBeVisible();
    await expect(main(page).getByText("Confirmado", { exact: true })).toBeVisible();
    await expect(main(page).getByText(/Avaria \(aberta\)/)).toBeVisible();

    // Bem disponível no local informado, com a vistoria concluída.
    await main(page)
      .getByRole("link", { name: new RegExp(`BEM-\\d+ \\(${serie}\\)`) })
      .click();
    await expect(main(page).getByText("Disponível")).toBeVisible();
    await expect(
      main(page).getByText("[DEMO] Obra Residencial Norte", { exact: true }),
    ).toBeVisible();
    await expect(main(page).getByRole("link", { name: /Entrada — / })).toBeVisible();

    // Evidências privadas: URL assinada só para quem pode ler a entidade.
    const src = await main(page).locator('img[src^="/api/files/"]').first().getAttribute("src");
    expect(src).toBeTruthy();
    const resposta = await page.request.get(src as string, { maxRedirects: 0 });
    expect(resposta.status()).toBe(302);
    expect(resposta.headers()["cache-control"]).toContain("no-store");
    const assinada = resposta.headers().location as string;
    expect(assinada).toContain("/storage/v1/object/sign/evidencias/");
    const arquivo = await page.request.get(assinada);
    expect(arquivo.status()).toBe(200);
    expect((await arquivo.body()).subarray(0, 3)).toEqual(JPEG_TESTE.subarray(0, 3));
    // URL sem assinatura não abre o bucket privado.
    const semToken = await page.request.get(
      assinada.replace("/object/sign/", "/object/public/").split("?")[0] as string,
    );
    expect(semToken.status()).toBeGreaterThanOrEqual(400);

    // Sem sessão (fetch puro, sem cookies): 401 antes de qualquer consulta.
    const anon = await fetch(new URL(src as string, page.url()), { redirect: "manual" });
    expect(anon.status).toBe(401);
    const outraEmpresa = await browser.newContext({ storageState: arquivoSessao("adminB") });
    expect((await outraEmpresa.request.get(src as string, { maxRedirects: 0 })).status()).toBe(404);
    await outraEmpresa.close();
    void dispositivo;
  });
});

test.describe("Excesso sobre o contratado (RN-25)", () => {
  test("Operação confirma acima do contratado → aguarda; Compras autoriza com justificativa", async ({
    browser,
  }, testInfo) => {
    const locacao = await criarLocacaoAtiva(
      `excesso ${testInfo.project.name} ${Date.now()}`,
      { individual: 1, lote: 20 },
      { loteSemChecklist: true },
    );
    const operacao = await browser.newContext({ storageState: arquivoSessao("operacaoA") });
    const page = await operacao.newPage();
    const id = await iniciarRecebimento(page, locacao.id);
    const lote = page.getByRole("form", { name: "Quantidade recebida de Andaime E2E" });
    await lote.getByLabel("Quantidade recebida (peça)").fill("25");
    await lote.getByRole("button", { name: "Registrar quantidade" }).click();
    await expect(page.getByText("Quantidade registrada.")).toBeVisible();
    await page.goto(`/recebimentos/${id}?etapa=destino`);
    await page
      .getByLabel("Local onde ficarão")
      .selectOption({ label: "[DEMO] Almoxarifado Central (ALM-CENTRAL)" });
    await page.getByRole("button", { name: "Salvar e revisar" }).click();
    await expect(page.getByText("Quantidade acima do contratado")).toBeVisible();
    await confirmarDialogo(page, "Confirmar recebimento", "Confirmar");
    await expect(page).toHaveURL(/aguardando=1$/);
    await expect(visivel(main(page).getByText("Aguardando autorização"))).toBeVisible();
    await expect(main(page).getByRole("button", { name: "Autorizar e confirmar" })).toHaveCount(0);
    await operacao.close();

    const compras = await browser.newContext({ storageState: arquivoSessao("comprasA") });
    const pc = await compras.newPage();
    await pc.goto(`/recebimentos/${id}`);
    await expect(pc.getByText(/excesso de 5/)).toBeVisible();
    await confirmarDialogo(
      pc,
      "Autorizar e confirmar",
      "Autorizar",
      "Fornecedor enviou 5 peças extras sem custo",
    );
    await expect(pc).toHaveURL(/confirmado=1$/);
    await expect(main(pc).getByText(/Divergência de quantidade \(aberta\)/)).toBeVisible();
    await expect(
      main(pc).getByText("Excesso autorizado: Fornecedor enviou 5 peças extras sem custo"),
    ).toBeVisible();
    await compras.close();
  });
});

test.describe("Permissões do recebimento", () => {
  test("Compras consulta mas não registra; Responsável local não acessa", async ({ browser }) => {
    const compras = await browser.newContext({ storageState: arquivoSessao("comprasA") });
    const pc = await compras.newPage();
    await pc.goto("/recebimentos");
    await expect(pc.getByRole("heading", { level: 1, name: "Recebimentos" })).toBeVisible();
    await expect(pc.getByRole("link", { name: "Novo recebimento" })).toHaveCount(0);
    await pc.goto("/recebimentos/novo");
    await expect(pc.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
    await compras.close();

    const rl = await browser.newContext({ storageState: arquivoSessao("responsavelA") });
    const pr = await rl.newPage();
    await pr.goto("/recebimentos");
    await expect(pr.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
    // Vê somente os bens sob sua responsabilidade (RLS).
    await pr.goto("/bens");
    await expect(visivel(pr.locator("main").getByText("BEM-000001"))).toBeVisible();
    await expect(pr.locator("main").getByText("BEM-000002")).toHaveCount(0);
    await rl.close();
  });
});

test.describe("API de arquivos (/api/files)", () => {
  test.use({ storageState: arquivoSessao("operacaoA") });

  test("recusa origem externa, entidade de outra empresa e conteúdo inválido", async ({
    page,
    baseURL,
  }) => {
    test.skip(test.info().project.name !== "chromium-desktop", "verificação de API, sem layout");
    const formulario = (entidadeId: string, buffer = JPEG_TESTE) => ({
      arquivo: { name: "f.jpg", mimeType: "image/jpeg", buffer },
      entidadeTipo: "BEM",
      entidadeId,
      tipo: "FOTO",
    });
    const origin = new URL(baseURL as string).origin;
    const BEM_A = "aa000000-0000-4000-8000-000000000002";
    const BEM_B = "ba000000-0000-4000-8000-000000000001";

    const semOrigem = await page.request.post("/api/files", { multipart: formulario(BEM_A) });
    expect(semOrigem.status()).toBe(403);
    const externa = await page.request.post("/api/files", {
      multipart: formulario(BEM_A),
      headers: { origin: "https://atacante.example" },
    });
    expect(externa.status()).toBe(403);

    const outraEmpresa = await page.request.post("/api/files", {
      multipart: formulario(BEM_B),
      headers: { origin },
    });
    expect(outraEmpresa.status()).toBe(404);

    const html = await page.request.post("/api/files", {
      multipart: formulario(BEM_A, Buffer.from("<html><script>alert(1)</script>")),
      headers: { origin },
    });
    expect(html.status()).toBe(422);

    const ok = await page.request.post("/api/files", {
      multipart: formulario(BEM_A),
      headers: { origin },
    });
    expect(ok.status()).toBe(201);
    const { id } = (await ok.json()) as { id: string };
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

test.describe("Documentos e vistorias", () => {
  test("Compras anexa o contrato (PDF) à locação; consulta privada", async ({
    browser,
  }, testInfo) => {
    const locacao = await criarLocacaoAtiva(`contrato ${testInfo.project.name} ${Date.now()}`);
    const compras = await browser.newContext({ storageState: arquivoSessao("comprasA") });
    const page = await compras.newPage();
    await page.goto(`/locacoes/${locacao.id}?aba=evidencias`);
    await anexar(page.getByLabel("Anexar contrato"), {
      name: "contrato-assinado.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"),
    });
    await expect(page.getByText("Arquivo enviado.")).toBeVisible();
    const link = visivel(main(page).getByRole("link", { name: "contrato-assinado.pdf" }));
    await expect(link).toBeVisible();
    await expect(visivel(main(page).getByText("Contrato", { exact: true }))).toBeVisible();
    const href = await link.getAttribute("href");
    const r = await page.request.get(href as string, { maxRedirects: 0 });
    expect(r.headers().location).toContain("/storage/v1/object/sign/contratos/");
    await compras.close();
  });

  test("lista de vistorias e detalhe somente leitura da vistoria concluída", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ storageState: arquivoSessao("gestorA") });
    const page = await ctx.newPage();
    await page.goto("/vistorias?status=CONCLUIDA");
    await expect(visivel(main(page).getByRole("link", { name: /^(BEM|LOT)-\d+$/ }))).toBeVisible();
    // A vistoria do seed pode sair da 1ª página conforme os testes criam outras: abre pela ficha.
    await page.goto(`/bens/${A.bemEstacao1}`);
    await main(page)
      .getByRole("link", { name: /^Entrada — / })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("BEM-000001");
    await expect(main(page).getByText("Concluída (imutável)")).toBeVisible();
    await expect(main(page).getByText("Resposta: Conforme")).toBeVisible();
    await expect(main(page).getByRole("button", { name: "Salvar respostas" })).toHaveCount(0);
    expect(await larguraExcedente(page)).toBeLessThanOrEqual(0);
    await ctx.close();
  });
});
