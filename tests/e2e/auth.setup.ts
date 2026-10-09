import { expect, test as setup } from "@playwright/test";

import { arquivoSessao, CONTAS, CONTAS_COM_SESSAO, entrar } from "./support/usuarios";

/** Grava uma sessão por perfil (login real no Supabase Auth) para os demais testes. */
for (const conta of CONTAS_COM_SESSAO) {
  setup(`sessão ${conta}`, async ({ page }) => {
    await entrar(page, CONTAS[conta]);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.context().storageState({ path: arquivoSessao(conta) });
  });
}
