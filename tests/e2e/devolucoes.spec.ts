/**
 * Gate da Fase 7: devolução em etapas (parcial de lote e bem individual) e os
 * encerramentos operacional e financeiro independentes (cenários 11–13).
 */
import { type Browser, expect, type Page, test } from "@playwright/test";

import { anexar, larguraExcedente } from "./helpers";
import { criarAtivosRecebidos, JPEG_TESTE } from "./support/dados";
import { arquivoSessao } from "./support/usuarios";

const main = (page: Page) => page.locator("main");
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");

async function semEstouro(page: Page, etapa: string) {
  expect(await larguraExcedente(page), etapa).toBeLessThanOrEqual(0);
}

const painel = (page: Page, titulo: string) => main(page).getByRole("group", { name: titulo });

async function sessao(browser: Browser, conta: "financeiroA" | "operacaoA", page: Page) {
  const ctx = await browser.newContext({
    storageState: arquivoSessao(conta),
    viewport: page.viewportSize() ?? { width: 1280, height: 800 },
  });
  return ctx.newPage();
}

test.use({ storageState: arquivoSessao("operacaoA") });

test("devolução parcial de lote e de bem individual: saldo só muda na retirada; comprovante e conferência", async ({
  page,
}) => {
  const { locacaoId, bens, lote } = await criarAtivosRecebidos("A", `dev-${Date.now()}`, 1, {
    loteSemChecklist: true,
  });
  const bem = bens[0];
  if (!bem || !lote) throw new Error("sem ativos");

  await page.goto(`/locacoes/${locacaoId}`);
  await main(page).getByRole("link", { name: "Solicitar devolução" }).first().click();
  await expect(page).toHaveURL(/\/devolucoes\/nova\?locacao=/);
  await semEstouro(page, "solicitar devolução");
  await page.getByRole("checkbox", { name: new RegExp(bem.codigo) }).check();
  await page.getByLabel(new RegExp(lote.codigo)).fill("5");
  await page.getByRole("button", { name: "Solicitar devolução" }).click();
  await expect(page).toHaveURL(/\/devolucoes\/[0-9a-f-]{36}\?solicitada=1$/);
  const devolucao = page.url().replace(/\?.*$/, "");
  await expect(page.getByText("Devolução solicitada. Os itens ficam reservados")).toBeVisible();

  // RN-53: o saldo não muda na solicitação.
  await page.goto(`/bens/lotes/${lote.id}`);
  await expect(page.getByText(/^Saldo 20$/)).toBeVisible();
  await expect(main(page).getByText(/Devolução DEV-\d+ aguardando retirada/)).toBeVisible();

  // Vistoria de saída do bem (a categoria tem checklist).
  await page.goto(devolucao);
  await main(page).getByRole("button", { name: "Fazer vistoria de saída" }).click();
  await expect(page).toHaveURL(/\/vistorias\/[0-9a-f-]{36}$/);
  await semEstouro(page, "vistoria de saída");
  await anexar(page.getByLabel("Foto desta pergunta").first(), {
    name: "saida.jpg",
    mimeType: "image/jpeg",
    buffer: JPEG_TESTE,
  });
  await expect(page.getByText("Arquivo enviado.").first()).toBeVisible();
  await page.getByRole("radio", { name: "Conforme", exact: true }).check();
  await page.getByRole("radio", { name: "Sim", exact: true }).check();
  await page.getByRole("button", { name: "Salvar respostas" }).click();
  await expect(page.getByText("Respostas salvas.")).toBeVisible();
  await page.getByRole("button", { name: "Concluir vistoria" }).click();
  await expect(page).toHaveURL(/\?concluida=1$/);
  await page.getByRole("link", { name: "Ver devolução" }).click();

  await page.getByRole("button", { name: "Agendar retirada" }).click();
  await expect(page.getByText("Retirada agendada.")).toBeVisible();
  await semEstouro(page, "devolução agendada");
  await page.getByLabel("Quem recebeu pelo fornecedor").fill("João da Locadora");
  const condicoes = page.getByLabel("Condição de saída");
  await condicoes.nth(0).selectOption("BOM");
  await condicoes.nth(1).selectOption("REGULAR");
  await page.getByRole("button", { name: "Confirmar retirada" }).click();
  await expect(page.getByText("Retirada confirmada: saldo atualizado.")).toBeVisible();
  await expect(main(page).getByText("Sem comprovante")).toBeVisible();

  await page.goto(`/bens/lotes/${lote.id}`);
  await expect(page.getByText(/^Saldo 15$/)).toBeVisible();
  await page.goto(`/bens/${bem.id}`);
  await expect(main(page).getByText("Devolvido").first()).toBeVisible();
  await expect(main(page).getByText("Retirado pelo fornecedor").first()).toBeVisible();

  await page.goto(devolucao);
  await anexar(page.getByLabel("Anexar comprovante"), {
    name: "comprovante.pdf",
    mimeType: "application/pdf",
    buffer: PDF,
  });
  await expect(page.getByText("Arquivo enviado.")).toBeVisible();
  await page.getByRole("button", { name: "Conferir devolução" }).click();
  await expect(page.getByText("Devolução conferida.")).toBeVisible();
  // Operação não registra ciência financeira.
  await expect(page.getByRole("button", { name: "Registrar ciência financeira" })).toHaveCount(0);
});

test("encerramentos operacional e financeiro são independentes (cenário 13)", async ({
  page,
  browser,
}) => {
  const { locacaoId, locacao, lote } = await criarAtivosRecebidos("A", `enc-${Date.now()}`, 0, {
    loteSemChecklist: true,
  });
  if (!lote) throw new Error("sem lote");

  // Devolução de todo o saldo: a desmobilização começa sozinha.
  await page.goto(`/devolucoes/nova?locacao=${locacaoId}`);
  await page.getByLabel(new RegExp(lote.codigo)).fill("20");
  await page.getByRole("button", { name: "Solicitar devolução" }).click();
  await expect(page).toHaveURL(/\?solicitada=1$/);
  await page.getByLabel("Quem recebeu pelo fornecedor").fill("Maria da Locadora");
  await page.getByLabel("Condição de saída").selectOption("BOM");
  await page.getByRole("checkbox", { name: /Retirada imediata/ }).check();
  await page.getByRole("button", { name: "Confirmar retirada" }).click();
  await expect(page.getByText("Retirada confirmada: saldo atualizado.")).toBeVisible();

  await page.goto(`/locacoes/${locacaoId}`);
  await semEstouro(page, "locação com saldo zerado");
  const operacional = painel(page, "Encerramento operacional");
  const financeiroPainel = painel(page, "Encerramento financeiro");
  await expect(operacional.getByText("Em devolução")).toBeVisible();
  await expect(financeiroPainel.getByText("Encerramento pendente")).toBeVisible();
  await expect(operacional.getByRole("button", { name: "Encerrar operação" })).toBeVisible();
  // Operação não confirma o encerramento financeiro nem registra cobrança.
  await expect(page.getByRole("button", { name: "Confirmar encerramento financeiro" })).toHaveCount(
    0,
  );
  await expect(main(page).getByRole("link", { name: "Registrar cobrança" })).toHaveCount(0);

  // Financeiro: cobrança pendente bloqueia; conferida, encerra com data.
  const fin = await sessao(browser, "financeiroA", page);
  await fin.goto("/cobrancas");
  await expect(fin.getByRole("link", { name: locacao })).toBeVisible();
  await fin.goto(`/cobrancas/nova?locacao=${locacaoId}`);
  await semEstouro(fin, "nova cobrança");
  await fin.getByLabel("Competência — início").fill("2026-09-01");
  await fin.getByLabel("Competência — fim").fill("2026-09-30");
  await fin.getByLabel("Valor cobrado (R$)").fill("1.234,56");
  await fin.getByLabel("Número do documento").fill("NF-777");
  await fin.getByRole("button", { name: "Registrar cobrança" }).click();
  await expect(fin.getByText("Cobrança registrada.")).toBeVisible();
  await expect(main(fin).getByText("R$ 1.234,56")).toBeVisible();
  const cobranca = fin.url().replace(/\?.*$/, "");

  await fin.goto(`/locacoes/${locacaoId}`);
  await expect(
    fin.getByText("Cobranças pendentes ou divergentes bloqueiam o encerramento"),
  ).toBeVisible();
  await fin.goto(cobranca);
  await fin.getByRole("button", { name: "Conferir cobrança" }).click();
  await expect(fin.getByText("Cobrança conferida.")).toBeVisible();

  await fin.goto(`/locacoes/${locacaoId}?aba=cobrancas`);
  await expect(
    fin.getByText(
      "Estimativa operacional — não substitui nota fiscal, fatura, boleto ou confirmação financeira.",
    ),
  ).toBeVisible();
  await fin.getByRole("button", { name: "Confirmar encerramento financeiro" }).click();
  await expect(
    fin.getByText("Encerramento financeiro confirmado com a data informada."),
  ).toBeVisible();
  // O operacional não foi tocado.
  await expect(painel(fin, "Encerramento operacional").getByText("Em devolução")).toBeVisible();
  await expect(
    painel(fin, "Encerramento financeiro").getByText("Financeiro: Encerrado", { exact: true }),
  ).toBeVisible();
  await expect(fin.getByRole("button", { name: "Encerrar operação" })).toHaveCount(0);
  await fin.context().close();

  // Operação encerra depois; o financeiro continua encerrado.
  await page.reload();
  await painel(page, "Encerramento operacional")
    .getByRole("button", { name: "Encerrar operação" })
    .click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Encerrar operação" }).click();
  await expect(
    page.getByText("Operação encerrada. O encerramento financeiro continua independente."),
  ).toBeVisible();
  await expect(
    painel(page, "Encerramento operacional").getByText("Encerrada (operacional)"),
  ).toBeVisible();
  await expect(
    painel(page, "Encerramento financeiro").getByText("Financeiro: Encerrado", { exact: true }),
  ).toBeVisible();
});
