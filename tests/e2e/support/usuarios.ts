import path from "node:path";

import { expect, type Page } from "@playwright/test";

/** Usuários do seed de demonstração (supabase/seed.sql). */
export const SENHA_DEMO = "Demo@123456";
export const DOMINIO = "demo.rastreio.test";

export const CONTAS = {
  adminA: `admin.a@${DOMINIO}`,
  comprasA: `compras.a@${DOMINIO}`,
  operacaoA: `operacao.a@${DOMINIO}`,
  responsavelA: `responsavel.a@${DOMINIO}`,
  financeiroA: `financeiro.a@${DOMINIO}`,
  gestorA: `gestor.a@${DOMINIO}`,
  auditorA: `auditor.a@${DOMINIO}`,
  inativoA: `inativo.a@${DOMINIO}`,
  recuperacaoA: `recuperacao.a@${DOMINIO}`,
  adminB: `admin.b@${DOMINIO}`,
  operacaoB: `operacao.b@${DOMINIO}`,
  semEmpresa: `sem.empresa@${DOMINIO}`,
  multi: `multi@${DOMINIO}`,
} as const;

export type Conta = keyof typeof CONTAS;

/** Contas com sessão pré-gravada pelo projeto de setup (auth.setup.ts). */
export const CONTAS_COM_SESSAO = [
  "adminA",
  "comprasA",
  "operacaoA",
  "responsavelA",
  "financeiroA",
  "gestorA",
  "auditorA",
  "adminB",
] as const satisfies readonly Conta[];

export const EMPRESA_A_ID = "a0000000-0000-4000-8000-000000000001";
export const EMPRESA_A_NOME = "[DEMONSTRAÇÃO] Empresa A Construções";
export const EMPRESA_B_NOME = "[DEMONSTRAÇÃO] Empresa B Engenharia";

export function arquivoSessao(conta: (typeof CONTAS_COM_SESSAO)[number]): string {
  return path.resolve(process.cwd(), "tests/e2e/.auth", `${conta}.json`);
}

/** Login pela interface (o mesmo caminho do usuário). */
export async function entrar(page: Page, email: string, senha = SENHA_DEMO, destino = "/login") {
  await page.goto(destino);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
}

export async function entrarComSucesso(page: Page, email: string, senha = SENHA_DEMO) {
  await entrar(page, email, senha);
  await expect(page).toHaveURL(/\/dashboard$/);
}
