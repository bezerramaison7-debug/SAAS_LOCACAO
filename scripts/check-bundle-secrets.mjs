#!/usr/bin/env node
/**
 * CA-06: garante que nenhum segredo do servidor chegou ao bundle do navegador.
 * Procura em .next/static (tudo o que é servido ao cliente):
 *  - os VALORES atuais de SUPABASE_SERVICE_ROLE_KEY e REPORT_SIGNING_SECRET;
 *  - os NOMES dessas variáveis (indício de import indevido de módulo de servidor).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const SEGREDOS = ["SUPABASE_SERVICE_ROLE_KEY", "REPORT_SIGNING_SECRET"];
const raiz = path.resolve(".next/static");

if (!existsSync(raiz)) {
  console.error("✗ .next/static não encontrado. Rode `npm run build` antes.");
  process.exit(1);
}

function* arquivos(dir) {
  for (const nome of readdirSync(dir)) {
    const caminho = path.join(dir, nome);
    if (statSync(caminho).isDirectory()) yield* arquivos(caminho);
    else yield caminho;
  }
}

const agulhas = [];
for (const nome of SEGREDOS) {
  agulhas.push({ rotulo: `nome ${nome}`, texto: nome });
  const valor = process.env[nome];
  if (valor && valor.length >= 8) agulhas.push({ rotulo: `valor de ${nome}`, texto: valor });
  else console.warn(`! ${nome} não definido no ambiente; verificando apenas o nome.`);
}

let total = 0;
const achados = [];
for (const arquivo of arquivos(raiz)) {
  total += 1;
  const conteudo = readFileSync(arquivo, "latin1");
  for (const { rotulo, texto } of agulhas) {
    if (conteudo.includes(texto)) achados.push(`${path.relative(".", arquivo)}: ${rotulo}`);
  }
}

if (achados.length > 0) {
  console.error("✗ Segredos encontrados no bundle do cliente:");
  for (const achado of achados) console.error(`  - ${achado}`);
  process.exit(1);
}
console.log(`✓ ${total} arquivos do cliente verificados; nenhum segredo encontrado.`);
