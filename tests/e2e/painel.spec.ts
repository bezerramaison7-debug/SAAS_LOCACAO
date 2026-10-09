/**
 * CA-72: cada indicador do painel abre a lista filtrada correspondente e o
 * total da lista bate com o número do indicador. Os outros testes rodam em
 * paralelo e criam dados, então a comparação é refeita (até 5 vezes) até
 * lista → indicador → lista coincidirem.
 */
import { expect, type Page, test, type TestInfo } from "@playwright/test";

import { dispositivo, larguraExcedente } from "./helpers";
import { arquivoSessao } from "./support/usuarios";

function contaDoProjeto(info: TestInfo) {
  return ({ celular: "responsavelA", tablet: "financeiroA", desktop: "adminA" } as const)[
    dispositivo(info)
  ];
}

async function totalDaLista(page: Page, href: string): Promise<number> {
  await page.goto(href);
  const texto = (
    await page.getByRole("navigation", { name: "Paginação" }).locator("p").innerText()
  ).trim();
  if (texto === "Nenhum registro") return 0;
  const m = /de ([\d.]+)$/.exec(texto);
  if (!m?.[1]) throw new Error(`Paginação inesperada em ${href}: ${texto}`);
  return Number(m[1].replace(/\./g, ""));
}

async function indicadores(page: Page) {
  await page.goto("/dashboard");
  const cartoes = page.locator("main [data-indicador]");
  await expect(cartoes.first()).toBeVisible();
  const lista: { id: string; href: string; valor: number; titulo: string }[] = [];
  for (const c of await cartoes.all()) {
    lista.push({
      id: (await c.getAttribute("data-indicador")) ?? "",
      href: (await c.getAttribute("href")) ?? "",
      valor: Number(await c.locator("[data-valor]").innerText()),
      titulo: (await c.locator("span").first().innerText()).trim(),
    });
  }
  return lista;
}

test("CA-72: cada indicador abre a lista filtrada com o mesmo total", async ({ browser }, info) => {
  test.setTimeout(180_000);
  const ctx = await browser.newContext({
    storageState: arquivoSessao(contaDoProjeto(info)),
    viewport: info.project.use.viewport ?? { width: 1280, height: 800 },
  });
  const page = await ctx.newPage();
  const todos = await indicadores(page);
  expect(await larguraExcedente(page)).toBeLessThanOrEqual(0);
  expect(todos.length).toBeGreaterThanOrEqual(contaDoProjeto(info) === "responsavelA" ? 5 : 12);
  // Todo indicador explica a regra de cálculo.
  for (const c of await page.locator("main [data-indicador]").all()) {
    await expect(c).toContainText("Regra:");
  }

  for (const indicador of todos) {
    let ok = false;
    let ultimo = "";
    for (let tentativa = 0; tentativa < 5 && !ok; tentativa++) {
      const antes = await totalDaLista(page, indicador.href);
      const valor = (await indicadores(page)).find((i) => i.id === indicador.id)?.valor;
      const depois = await totalDaLista(page, indicador.href);
      ok = antes === depois && valor === antes;
      ultimo = `${indicador.titulo}: lista ${antes}/${depois}, painel ${valor}`;
    }
    expect(ok, ultimo).toBe(true);
  }

  // O clique leva à lista filtrada (não só o href).
  await page.goto("/dashboard");
  const primeiro = page.locator("main [data-indicador]").first();
  const destino = (await primeiro.getAttribute("href")) ?? "";
  await primeiro.click();
  await expect(page).toHaveURL(new RegExp(destino.replace(/[?]/g, "\\?").replace(/,/g, "(,|%2C)")));
  await ctx.close();
});
