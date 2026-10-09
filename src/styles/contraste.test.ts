import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Garante contraste WCAG AA (≥ 4.5:1 para texto normal) entre os pares de
 * tokens efetivamente usados para texto, nos temas claro e escuro.
 */
const css = readFileSync(path.join(import.meta.dirname, "globals.css"), "utf8");

function tokensDoBloco(seletor: string): Record<string, string> {
  const inicio = css.indexOf(seletor);
  if (inicio < 0) throw new Error(`Bloco não encontrado: ${seletor}`);
  const corpo = css.slice(css.indexOf("{", inicio) + 1, css.indexOf("}", inicio));
  return Object.fromEntries(
    [...corpo.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/gi)].map((m) => [m[1], m[2]]),
  ) as Record<string, string>;
}

function luminancia(hex: string): number {
  const canais = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = canais.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

function contraste(a: string, b: string): number {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return ((l1 ?? 0) + 0.05) / ((l2 ?? 0) + 0.05);
}

const PARES: readonly [texto: string, fundo: string][] = [
  ["texto", "fundo"],
  ["texto", "superficie"],
  ["texto", "superficie-2"],
  ["texto-suave", "fundo"],
  ["texto-suave", "superficie"],
  ["texto-suave", "superficie-2"],
  ["primaria", "superficie"],
  ["primaria", "primaria-suave"],
  ["primaria-contraste", "primaria"],
  ["primaria-contraste", "primaria-hover"],
  ["perigo-contraste", "perigo"],
  ["perigo", "superficie"],
  ["sucesso", "sucesso-suave"],
  ["alerta", "alerta-suave"],
  ["perigo", "perigo-suave"],
  ["info", "info-suave"],
  ["texto", "neutro-suave"],
];

const temas = {
  claro: tokensDoBloco(":root {"),
  escuro: tokensDoBloco(':root[data-theme="escuro"]'),
};

describe.each(Object.entries(temas))("contraste WCAG AA — tema %s", (_, tokens) => {
  it.each(PARES)("%s sobre %s ≥ 4.5:1", (texto, fundo) => {
    const corTexto = tokens[texto];
    const corFundo = tokens[fundo];
    expect(corTexto, `token --${texto}`).toBeDefined();
    expect(corFundo, `token --${fundo}`).toBeDefined();
    expect(contraste(corTexto ?? "", corFundo ?? "")).toBeGreaterThanOrEqual(4.5);
  });
});

it("tema escuro por preferência do sistema é idêntico ao tema escuro explícito", () => {
  expect(tokensDoBloco(':root:not([data-theme="claro"])')).toEqual(temas.escuro);
});
