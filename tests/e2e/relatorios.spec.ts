/**
 * Gate da Fase 8: o usuário gera o relatório completo da locação — com as
 * fotos já registradas no sistema — sem manipular nenhum arquivo à mão.
 */
import { createHash } from "node:crypto";

import { expect, type Page, test, type TestInfo } from "@playwright/test";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";

import { anexar, dispositivo, larguraExcedente } from "./helpers";
import { criarAtivosRecebidos, JPEG_TESTE } from "./support/dados";
import { arquivoSessao } from "./support/usuarios";

const main = (page: Page) => page.locator("main");

/** Cada tamanho de tela pede com um usuário (limite de 10 pedidos/10 min por usuário). */
function contaDoProjeto(info: TestInfo) {
  return ({ celular: "operacaoA", tablet: "financeiroA", desktop: "adminA" } as const)[
    dispositivo(info)
  ];
}

async function lerPdf(pdf: Uint8Array) {
  const doc = await getDocument({
    data: pdf,
    useSystemFonts: false,
    standardFontDataUrl: `${process.cwd()}/node_modules/pdfjs-dist/standard_fonts/`,
  }).promise;
  let texto = "";
  let imagens = 0;
  for (let p = 1; p <= doc.numPages; p++) {
    const pagina = await doc.getPage(p);
    texto += (await pagina.getTextContent()).items.map((i) => ("str" in i ? i.str : "")).join(" ");
    imagens += (await pagina.getOperatorList()).fnArray.filter(
      (f) => f === OPS.paintImageXObject,
    ).length;
  }
  return { texto: texto.replace(/\s+/g, " "), imagens };
}

test("gate: relatório da locação com fotos, legendas e hashes, gerado pela interface", async ({
  browser,
}, info) => {
  const { locacaoId, locacao, bens } = await criarAtivosRecebidos("A", `rel-${Date.now()}`, 1, {
    loteSemChecklist: true,
  });
  const bem = bens[0];
  if (!bem) throw new Error("sem bem");

  // A foto entra pelo fluxo normal (ficha do bem); o relatório a busca sozinho.
  const operacao = await browser.newContext({ storageState: arquivoSessao("operacaoA") });
  const op = await operacao.newPage();
  await op.goto(`/bens/${bem.id}`);
  await anexar(op.getByLabel("Adicionar foto"), {
    name: "campo.jpg",
    mimeType: "image/jpeg",
    buffer: JPEG_TESTE,
  });
  await expect(op.getByText("Arquivo enviado.")).toBeVisible();
  await operacao.close();

  const ctx = await browser.newContext({
    storageState: arquivoSessao(contaDoProjeto(info)),
    viewport: info.project.use.viewport ?? { width: 1280, height: 800 },
  });
  const page = await ctx.newPage();
  await page.goto(`/locacoes/${locacaoId}`);
  await main(page).getByRole("button", { name: "Gerar relatório PDF" }).click();
  // CA-71: o pedido volta na hora; a página acompanha até ficar pronto.
  await expect(page).toHaveURL(/\/relatorios\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Relatório REL-\d+/);
  await expect(main(page).getByText("Pronto")).toBeVisible({ timeout: 90_000 });
  expect(await larguraExcedente(page)).toBeLessThanOrEqual(0);

  const valor = (rotulo: string) =>
    main(page).locator("dt", { hasText: rotulo }).locator("xpath=following-sibling::dd[1]");
  const hashDados = (await valor("Hash SHA-256 dos dados").innerText()).trim();
  const hashArquivo = (await valor("Hash SHA-256 do arquivo").innerText()).trim();
  expect(hashDados).toMatch(/^[0-9a-f]{64}$/);

  const link = main(page).getByRole("link", { name: "Baixar PDF" });
  const href = (await link.getAttribute("href")) ?? "";
  const redirecionamento = await ctx.request.get(href, { maxRedirects: 0 });
  expect(redirecionamento.status()).toBe(302);
  const assinada = redirecionamento.headers().location ?? "";
  expect(assinada).toContain("/storage/v1/object/sign/relatorios/");
  const arquivo = new Uint8Array(await (await fetch(assinada)).arrayBuffer());
  expect(createHash("sha256").update(arquivo).digest("hex")).toBe(hashArquivo);

  const { texto, imagens } = await lerPdf(arquivo);
  for (const trecho of [
    `Relatório da locação ${locacao}`,
    "Identificação e estado",
    "Referências Sectra",
    "Itens contratados, recebidos, devolvidos e saldo",
    "Fichas dos bens e lotes",
    "Recebimentos",
    "Movimentações",
    "Ocorrências",
    "Devoluções e comprovantes",
    "Fotografias",
    `Ficha do bem · Item ${bem.codigo}`,
    "Por: [DEMO] Olívia Operação (A)",
    "relatorio-1.0",
  ]) {
    expect(texto, trecho).toContain(trecho);
  }
  expect(texto.replace(/\s/g, "")).toContain(hashDados);
  expect(imagens).toBeGreaterThanOrEqual(1);

  // Sem sessão o download não abre; outra empresa não vê o relatório.
  const anonimo = await fetch(new URL(href, info.project.use.baseURL).toString(), {
    redirect: "manual",
  });
  expect([302, 307, 401]).toContain(anonimo.status);
  expect(anonimo.headers.get("location") ?? "").not.toContain("/storage/");
  const b = await browser.newContext({ storageState: arquivoSessao("adminB") });
  const pb = await b.newPage();
  await pb.goto(page.url().replace(/^https?:\/\/[^/]+/, ""));
  await expect(pb.getByText("Página não encontrada")).toBeVisible();
  const resposta = await b.request.get(href, { maxRedirects: 0 });
  expect(resposta.status()).toBe(404);
  await b.close();
  await ctx.close();
});

test.describe("formulário de relatórios", () => {
  test.use({ storageState: arquivoSessao("gestorA") });

  test("relatório do período pelo formulário e acesso negado ao responsável local", async ({
    page,
    browser,
  }, info) => {
    test.skip(dispositivo(info) !== "desktop", "Um pedido basta (limite por usuário)");
    await page.goto("/relatorios");
    expect(await larguraExcedente(page)).toBeLessThanOrEqual(0);
    await page.getByLabel("Tipo de relatório").selectOption("PERIODO");
    await page.getByRole("button", { name: "Gerar relatório" }).click();
    await expect(page).toHaveURL(/\/relatorios\/[0-9a-f-]{36}$/);
    await expect(main(page).getByText("Pronto")).toBeVisible({ timeout: 90_000 });
    await page.goto("/relatorios");
    await expect(
      main(page)
        .getByText(/^Período · /)
        .filter({ visible: true })
        .first(),
    ).toBeVisible();

    const rl = await browser.newContext({ storageState: arquivoSessao("responsavelA") });
    const p = await rl.newPage();
    await p.goto("/relatorios");
    await expect(p.getByText("Página não encontrada")).toBeVisible();
    await rl.close();
  });
});
