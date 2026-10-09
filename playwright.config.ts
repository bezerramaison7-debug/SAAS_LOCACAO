import { existsSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

const PORTA = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORTA}`;
const CI = Boolean(process.env.CI);
/** Suíte completa (3 navegadores) antes de implantação; smoke só em Chromium. */
const COMPLETA = process.env.E2E_FULL === "1";

// Ambiente de desenvolvimento em nuvem: Chromium pré-instalado em versão diferente.
const CHROMIUM_LOCAL = "/opt/pw-browsers/chromium";
const launchOptions =
  !CI && existsSync(CHROMIUM_LOCAL) ? { executablePath: CHROMIUM_LOCAL } : undefined;

const viewports = {
  celular: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
} as const;

/**
 * Matriz de projetos: Chromium sempre (3 tamanhos); com E2E_FULL=1, Firefox e
 * WebKit nos mesmos 3 tamanhos (F9.1). Firefox não suporta `isMobile`: no
 * celular ele usa só a largura e o toque.
 */
const motores = {
  chromium: devices["Desktop Chrome"],
  firefox: devices["Desktop Firefox"],
  webkit: devices["Desktop Safari"],
} as const;

function projetos(motor: keyof typeof motores) {
  return Object.entries(viewports).map(([nome, viewport]) => ({
    name: `${motor}-${nome}`,
    dependencies: ["setup"],
    use: {
      ...motores[motor],
      viewport,
      ...(nome === "celular"
        ? motor === "firefox"
          ? { hasTouch: true }
          : { isMobile: true, hasTouch: true }
        : {}),
      ...(motor === "chromium" && launchOptions ? { launchOptions } : {}),
    },
  }));
}

const navegadores = COMPLETA
  ? [...projetos("chromium"), ...projetos("firefox"), ...projetos("webkit")]
  : projetos("chromium");

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"], ...(launchOptions ? { launchOptions } : {}) },
    },
    ...navegadores,
  ],
  ...(process.env.E2E_BASE_URL
    ? {}
    : {
        webServer: {
          // Testa o build de produção (rode `npm run build` antes).
          command: `npx next start -p ${PORTA}`,
          url: `${BASE_URL}/api/health`,
          reuseExistingServer: !CI,
          timeout: 120_000,
        },
      }),
});
