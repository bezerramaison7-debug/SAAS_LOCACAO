/**
 * Gate da Fase 6: local e responsável atuais = último evento confirmado, com o
 * histórico intacto (movimentação com e sem aceite, recusa, divisão de lote,
 * ocorrências com efeito no estado, troca, vistoria periódica e QR Code).
 */
import { type Browser, expect, type Locator, type Page, test } from "@playwright/test";

import { anexar, larguraExcedente } from "./helpers";
import { criarAtivosRecebidos, JPEG_TESTE } from "./support/dados";
import { arquivoSessao, CONTAS, entrar } from "./support/usuarios";

const main = (page: Page) => page.locator("main");
const visivel = (l: Locator) => l.filter({ visible: true }).first();

const ALM_A = "[DEMO] Almoxarifado Central";
const OBRA_NORTE = "[DEMO] Obra Residencial Norte";
const OBRA_SUL = "[DEMO] Obra Ponte Sul";
const ALM_B = "[DEMO] Almoxarifado B";
const OBRA_B = "[DEMO] Obra Industrial B";
const OLIVIA = "[DEMO] Olívia Operação (A)";
const RAFAEL = "[DEMO] Rafael Responsável (A)";
const BRUNA = "[DEMO] Bruna Admin (B)";
const OTAVIO = "[DEMO] Otávio Operação (B)";

/** Valor exibido para um campo da ficha (lista de definições). */
const campo = (page: Page, nome: string) =>
  main(page)
    .locator("dt", { hasText: new RegExp(`^${nome}$`) })
    .locator("xpath=following-sibling::dd[1]");

const linhaDoTempo = (page: Page) =>
  main(page).locator("section", { has: page.getByRole("heading", { name: "Linha do tempo" }) });

async function semEstouro(page: Page, etapa: string) {
  expect(await larguraExcedente(page), etapa).toBeLessThanOrEqual(0);
}

async function movimentar(
  page: Page,
  alvo: string,
  dados: { destino: string; responsavel?: string; quantidade?: string; motivo?: string },
) {
  await page.goto(`/movimentacoes/nova?${alvo}`);
  await semEstouro(page, "nova movimentação");
  // Opções de local trazem o código entre parênteses: escolhe pelo nome.
  const destino = page.getByLabel("Local de destino");
  const valor = await destino.locator("option", { hasText: dados.destino }).getAttribute("value");
  await destino.selectOption(valor ?? "");
  if (dados.responsavel)
    await page.getByLabel("Novo responsável").selectOption({ label: dados.responsavel });
  if (dados.quantidade) await page.getByLabel(/Quantidade a movimentar/).fill(dados.quantidade);
  await page.getByLabel("Motivo").fill(dados.motivo ?? "Envio para a frente de serviço");
  await page.getByRole("button", { name: "Registrar movimentação" }).click();
  await expect(page).toHaveURL(/\/movimentacoes\/[0-9a-f-]{36}\?registrada=1$/);
}

async function sessaoDe(browser: Browser, email: string): Promise<Page> {
  const contexto = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await contexto.newPage();
  await entrar(page, email);
  await expect(page).toHaveURL(/\/dashboard$/);
  return page;
}

test.describe("movimentação sem aceite (empresa A)", () => {
  test.use({ storageState: arquivoSessao("operacaoA") });

  test("confirma na hora: ficha mostra o último evento e a linha do tempo preserva a origem", async ({
    page,
    browser,
  }) => {
    const { bens } = await criarAtivosRecebidos("A", "mov-bem");
    const bem = bens[0];
    if (!bem) throw new Error("sem bem");
    await movimentar(page, `bem=${bem.id}`, { destino: OBRA_NORTE, responsavel: RAFAEL });
    await expect(page.getByText("Movimentação registrada.")).toBeVisible();

    await page.goto(`/bens/${bem.id}`);
    await semEstouro(page, "ficha do bem");
    await expect(campo(page, "Local atual")).toHaveText(OBRA_NORTE);
    await expect(campo(page, "Responsável atual")).toHaveText(RAFAEL);
    const historico = linhaDoTempo(page);
    await expect(
      historico.getByText(`Movimentação confirmada: ${ALM_A} → ${OBRA_NORTE}`),
    ).toBeVisible();
    await expect(historico.getByText(`Recebido em ${ALM_A}`)).toBeVisible();

    // "Meus itens" do novo responsável.
    const rafael = await sessaoDe(browser, CONTAS.responsavelA);
    await rafael.goto("/bens?meus=1");
    await expect(rafael.getByRole("checkbox", { name: "Só meus itens" })).toBeChecked();
    await expect(visivel(main(rafael).getByRole("link", { name: bem.codigo }))).toBeVisible();

    // Segunda movimentação: vale a mais recente; a anterior continua no histórico.
    await movimentar(page, `bem=${bem.id}`, { destino: OBRA_SUL, responsavel: OLIVIA });
    await page.goto(`/bens/${bem.id}`);
    await expect(campo(page, "Local atual")).toHaveText(OBRA_SUL);
    await expect(campo(page, "Responsável atual")).toHaveText(OLIVIA);
    const eventos = linhaDoTempo(page).locator("li");
    await expect(eventos.first()).toContainText(`${OBRA_NORTE} → ${OBRA_SUL}`);
    await expect(linhaDoTempo(page).getByText(`${ALM_A} → ${OBRA_NORTE}`)).toBeVisible();

    // Deixou de ser dele: sai de "meus itens".
    await rafael.reload();
    await expect(main(rafael).getByRole("link", { name: bem.codigo })).toHaveCount(0);
    await rafael.context().close();
  });

  test("lote: movimentação parcial divide o lote e mantém a origem com o saldo restante", async ({
    page,
  }) => {
    const { lote } = await criarAtivosRecebidos("A", "mov-lote");
    if (!lote) throw new Error("sem lote");
    await movimentar(page, `lote=${lote.id}`, { destino: OBRA_SUL, quantidade: "5" });

    await page.goto(`/bens/lotes/${lote.id}`);
    await semEstouro(page, "ficha do lote");
    await expect(campo(page, "Local atual")).toHaveText(ALM_A);
    await expect(page.getByText(/^Saldo 15(,0+)?$/)).toBeVisible();
    await expect(linhaDoTempo(page).getByText(`${ALM_A} → ${OBRA_SUL}`)).toBeVisible();

    // O lote novo nasce no destino, ligado à origem.
    await linhaDoTempo(page)
      .getByRole("link", { name: /Movimentação confirmada/ })
      .click();
    await campo(page, "Item").getByRole("link").click();
    await expect(page).toHaveURL(/\/bens\/lotes\/[0-9a-f-]{36}$/);
    expect(page.url()).not.toContain(lote.id);
    await expect(campo(page, "Local atual")).toHaveText(OBRA_SUL);
    await expect(page.getByText(/^Saldo 5(,0+)?$/)).toBeVisible();
    await expect(
      linhaDoTempo(page).getByText(`Criado por divisão do lote ${lote.codigo}`),
    ).toBeVisible();
  });
});

test.describe("movimentação com aceite (empresa B exige aceite)", () => {
  test.use({ storageState: arquivoSessao("adminB") });

  test("fica em transferência até o destinatário aceitar; recusa mantém a origem", async ({
    page,
    browser,
  }) => {
    const { bens } = await criarAtivosRecebidos("B", "aceite", 2);
    const [aceito, recusado] = bens;
    if (!aceito || !recusado) throw new Error("sem bens");

    await movimentar(page, `bem=${aceito.id}`, { destino: OBRA_B, responsavel: OTAVIO });
    await expect(
      page.getByText(`Aguardando o aceite de ${OTAVIO}. Até lá, o item continua na origem.`),
    ).toBeVisible();
    await movimentar(page, `bem=${recusado.id}`, { destino: OBRA_B, responsavel: OTAVIO });

    await page.goto(`/bens/${aceito.id}`);
    await expect(campo(page, "Local atual")).toHaveText(ALM_B);
    await expect(campo(page, "Responsável atual")).toHaveText(BRUNA);
    await expect(main(page).getByText(/Transferência MOV-\d+ aguardando aceite/)).toBeVisible();
    // Pendente bloqueia nova movimentação (sem botão morto).
    await expect(main(page).getByRole("link", { name: "Movimentar" })).toHaveCount(0);

    const otavio = await sessaoDe(browser, CONTAS.operacaoB);
    await otavio.goto("/movimentacoes");
    await semEstouro(otavio, "aceite");
    const pendencia = (codigo: string) =>
      otavio
        .getByRole("region", { name: /Aguardando o seu aceite/ })
        .locator("li", { hasText: codigo });
    await pendencia(aceito.codigo).getByRole("button", { name: "Aceitar" }).click();
    await expect(
      otavio.getByText("Movimentação aceita: local e responsável atualizados."),
    ).toBeVisible();

    await otavio.goto("/movimentacoes");
    await expect(pendencia(aceito.codigo)).toHaveCount(0);
    await pendencia(recusado.codigo).getByRole("button", { name: "Recusar" }).click();
    const dialogo = otavio.getByRole("alertdialog");
    await dialogo.getByLabel("Motivo da recusa").fill("Equipamento não solicitado para esta obra");
    await dialogo.getByRole("button", { name: "Recusar" }).click();
    await expect(
      otavio.getByText("Movimentação recusada: o item continua na origem."),
    ).toBeVisible();
    await otavio.goto("/movimentacoes");
    await expect(pendencia(recusado.codigo)).toHaveCount(0);
    await otavio.context().close();

    await page.goto(`/bens/${aceito.id}`);
    await expect(campo(page, "Local atual")).toHaveText(OBRA_B);
    await expect(campo(page, "Responsável atual")).toHaveText(OTAVIO);
    await expect(
      linhaDoTempo(page).getByText(`Movimentação confirmada: ${ALM_B} → ${OBRA_B}`),
    ).toBeVisible();

    await page.goto(`/bens/${recusado.id}`);
    await expect(campo(page, "Local atual")).toHaveText(ALM_B);
    await expect(campo(page, "Responsável atual")).toHaveText(BRUNA);
    await expect(
      linhaDoTempo(page).getByText(`Movimentação recusada: ${ALM_B} → ${OBRA_B}`),
    ).toBeVisible();
    await expect(main(page).getByRole("link", { name: "Movimentar" })).toBeVisible();
  });
});

test.describe("ocorrências, troca, vistoria e QR (empresa A)", () => {
  test.use({ storageState: arquivoSessao("operacaoA") });

  test("manutenção bloqueia movimentação até a resolução; extravio e resolução ficam na linha do tempo", async ({
    page,
  }) => {
    const { bens } = await criarAtivosRecebidos("A", "ocorrencia", 2);
    const [defeito, extravio] = bens;
    if (!defeito || !extravio) throw new Error("sem bens");

    await page.goto(`/bens/${defeito.id}`);
    await main(page).getByRole("link", { name: "Registrar ocorrência" }).click();
    await semEstouro(page, "nova ocorrência");
    await page.getByLabel("Tipo").selectOption({ label: "Defeito" });
    await page.getByLabel("Descrição").fill("Display não liga após transporte");
    await page.getByLabel("Enviar para manutenção").check();
    await page.getByRole("button", { name: "Registrar ocorrência" }).click();
    await expect(page).toHaveURL(/\/ocorrencias\/[0-9a-f-]{36}/);

    await page.goto(`/bens/${defeito.id}`);
    await expect(main(page).getByText("Em manutenção").first()).toBeVisible();
    await expect(main(page).getByRole("link", { name: "Movimentar" })).toHaveCount(0);
    await linhaDoTempo(page).getByRole("link", { name: "Ocorrência defeito" }).click();
    await page.getByLabel("Resultado").selectOption({ label: "Reparado" });
    await page.getByLabel("Como foi resolvida").fill("Fonte substituída pelo fornecedor");
    await page.getByRole("button", { name: "Resolver ocorrência" }).click();
    // Aviso da ação concluída (o rótulo "Como foi resolvida" já casaria com "Resolvida").
    await expect(page.getByText("Ocorrência resolvida.")).toBeVisible();

    await page.goto(`/bens/${defeito.id}`);
    await expect(main(page).getByRole("link", { name: "Movimentar" })).toBeVisible();
    await expect(campo(page, "Local atual")).toHaveText(ALM_A);
    await expect(
      linhaDoTempo(page).getByText(/Ocorrência .*resolvida \(reparado\)/i),
    ).toBeVisible();

    await page.goto(`/ocorrencias/nova?bem=${extravio.id}`);
    await page.getByLabel("Tipo").selectOption({ label: "Extravio" });
    await page.getByLabel("Descrição").fill("Não localizado na conferência semanal");
    await page.getByRole("button", { name: "Registrar ocorrência" }).click();
    await expect(page).toHaveURL(/\/ocorrencias\/[0-9a-f-]{36}/);
    await page.goto(`/bens/${extravio.id}`);
    await expect(main(page).getByText("Extraviado").first()).toBeVisible();
    await expect(main(page).getByText(/Extravio OCR-\d+ em aberto/)).toBeVisible();
    // Local e responsável não mudam com o extravio (responsabilidade continua).
    await expect(campo(page, "Responsável atual")).toHaveText(OLIVIA);
  });

  test("troca: novo bem entra no lugar com vistoria de entrada; o antigo fica substituído", async ({
    page,
  }) => {
    const { bens } = await criarAtivosRecebidos("A", "troca");
    const antigo = bens[0];
    if (!antigo) throw new Error("sem bem");
    await movimentar(page, `bem=${antigo.id}`, { destino: OBRA_NORTE, responsavel: RAFAEL });

    await page.goto(`/bens/${antigo.id}`);
    await main(page).getByRole("link", { name: "Registrar troca" }).click();
    await semEstouro(page, "troca");
    await page.getByLabel(/Motivo/).fill("Fornecedor substituiu por defeito recorrente");
    await page.getByLabel("Número de série do novo bem").fill(`TROCA-${Date.now()}`);
    await page.getByRole("button", { name: "Registrar troca" }).click();
    await expect(page).toHaveURL(/\/bens\/[0-9a-f-]{36}\?substituto=1$/);
    expect(page.url()).not.toContain(antigo.id);
    await expect(
      page.getByText("Troca registrada. Faça a vistoria de entrada do novo bem."),
    ).toBeVisible();
    // Herda local e responsável do antigo (último evento confirmado).
    await expect(campo(page, "Local atual")).toHaveText(OBRA_NORTE);
    await expect(campo(page, "Responsável atual")).toHaveText(RAFAEL);
    await expect(main(page).getByText("Vistoria de entrada pendente")).toBeVisible();
    await expect(linhaDoTempo(page).getByText("Entrou em substituição")).toBeVisible();

    await page.goto(`/bens/${antigo.id}`);
    await expect(main(page).getByText("Substituído").first()).toBeVisible();
    await expect(main(page).getByRole("link", { name: "Movimentar" })).toHaveCount(0);
    await expect(linhaDoTempo(page).getByText(`${ALM_A} → ${OBRA_NORTE}`)).toBeVisible();
  });

  test("vistoria periódica: respostas, foto exigida e conclusão imutável", async ({ page }) => {
    const { bens } = await criarAtivosRecebidos("A", "periodica");
    const bem = bens[0];
    if (!bem) throw new Error("sem bem");
    await page.goto(`/bens/${bem.id}`);
    await main(page).getByRole("button", { name: "Vistoria periódica" }).click();
    await expect(page).toHaveURL(/\/vistorias\/[0-9a-f-]{36}$/);
    await semEstouro(page, "vistoria periódica");

    // Sem respostas: concluir mostra as pendências.
    await expect(page.getByText("Pendências para concluir")).toBeVisible();
    await page.getByRole("button", { name: "Concluir vistoria" }).click();
    await expect(page.getByText(/Vistoria incompleta/)).toBeVisible();

    await anexar(page.getByLabel("Foto desta pergunta").first(), {
      name: "periodica.jpg",
      mimeType: "image/jpeg",
      buffer: JPEG_TESTE,
    });
    await expect(page.getByText("Arquivo enviado.").first()).toBeVisible();
    await page.getByRole("radio", { name: "Conforme", exact: true }).check();
    await page.getByRole("radio", { name: "Sim", exact: true }).check();
    await page.getByRole("button", { name: "Salvar respostas" }).click();
    await expect(page.getByText("Respostas salvas.")).toBeVisible();
    await expect(page.getByText("Pendências para concluir")).toBeHidden();
    await page.getByRole("button", { name: "Concluir vistoria" }).click();
    await expect(page).toHaveURL(/\?concluida=1$/);
    await expect(page.getByText("Concluída (imutável)")).toBeVisible();
    await expect(page.getByRole("button", { name: "Salvar respostas" })).toHaveCount(0);

    await page.goto(`/bens/${bem.id}`);
    await expect(linhaDoTempo(page).getByText("Vistoria periodica concluída")).toBeVisible();
  });

  test("QR Code: etiqueta imprimível e /q/{id} abre a ficha só para quem pode ver", async ({
    page,
    browser,
  }) => {
    const { bens, lote } = await criarAtivosRecebidos("A", "qr");
    const bem = bens[0];
    if (!bem || !lote) throw new Error("sem ativos");

    await page.goto(`/etiquetas/bem/${bem.id}`);
    await semEstouro(page, "etiqueta");
    const etiqueta = page.getByRole("article", { name: `Etiqueta ${bem.codigo}` });
    await expect(etiqueta.getByText(bem.codigo)).toBeVisible();
    const qr = etiqueta.getByRole("img", { name: `QR Code de ${bem.codigo}` });
    await expect(qr).toHaveAttribute("src", /^data:image\/svg\+xml;base64,/);
    await expect(page.getByRole("button", { name: "Imprimir etiqueta" })).toBeVisible();
    await expect(page.getByText(new RegExp(`/q/${bem.id}`))).toBeVisible();

    await page.goto(`/q/${bem.id}`);
    await expect(page).toHaveURL(new RegExp(`/bens/${bem.id}$`));
    await page.goto(`/q/${lote.id}`);
    await expect(page).toHaveURL(new RegExp(`/bens/lotes/${lote.id}$`));

    // Sem sessão: login com retorno ao QR.
    const anonimo = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const visitante = await anonimo.newPage();
    await visitante.goto(`/q/${bem.id}`);
    await expect(visitante).toHaveURL(/\/login\?next=%2Fq%2F/);
    await anonimo.close();

    // Outra empresa: não encontrado (RLS).
    const b = await browser.newContext({ storageState: arquivoSessao("adminB") });
    const outra = await b.newPage();
    await outra.goto(`/q/${bem.id}`);
    await expect(outra.getByText("Página não encontrada")).toBeVisible();
    await expect(outra).toHaveURL(new RegExp(`/q/${bem.id}$`));
    await b.close();
  });
});
