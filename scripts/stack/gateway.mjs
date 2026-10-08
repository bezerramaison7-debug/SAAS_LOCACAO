#!/usr/bin/env node
/**
 * Gateway da stack local (D-36) — substitui o Kong do `supabase start`:
 *   /auth/v1/*  → GoTrue      (127.0.0.1:9999)
 *   /rest/v1/*  → PostgREST   (127.0.0.1:54330)
 * Como o Kong, exige `apikey` válida (anon ou service_role) nas rotas de dados
 * e repassa o restante sem alterações. Somente desenvolvimento/teste.
 */
import { readFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";

import { ANON_KEY, SERVICE_ROLE_KEY } from "./chaves.mjs";

const PORTA = Number(process.env.GATEWAY_PORT ?? 54321);
const ROTAS = [
  { prefixo: "/auth/v1", destino: { host: "127.0.0.1", port: 9999 }, exigeChave: false },
  { prefixo: "/rest/v1", destino: { host: "127.0.0.1", port: 54330 }, exigeChave: true },
];
const CHAVES = new Set([ANON_KEY, SERVICE_ROLE_KEY]);

const TEMPLATES = path.resolve(import.meta.dirname, "../../supabase/templates");

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://local");
  // Modelos de e-mail para o GoTrue (equivalente a content_path do config.toml).
  if (url.pathname.startsWith("/__templates/")) {
    const nome = path.basename(url.pathname);
    try {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(await readFile(path.join(TEMPLATES, nome)));
    } catch {
      res.writeHead(404).end();
    }
    return;
  }
  const rota = ROTAS.find(
    (r) => url.pathname === r.prefixo || url.pathname.startsWith(`${r.prefixo}/`),
  );
  if (!rota) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: "rota inexistente no gateway local" }));
    return;
  }
  const apikey = req.headers.apikey ?? url.searchParams.get("apikey");
  if (rota.exigeChave && !CHAVES.has(String(apikey))) {
    res.writeHead(401, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: "Invalid API key" }));
    return;
  }
  url.searchParams.delete("apikey"); // como o Kong: não repassa a chave como filtro
  const headers = { ...req.headers, host: `${rota.destino.host}:${rota.destino.port}` };
  // Como o Kong: sem Authorization, usa a própria apikey como bearer.
  if (!headers.authorization && apikey) headers.authorization = `Bearer ${apikey}`;
  const proxy = http.request(
    {
      ...rota.destino,
      method: req.method,
      path: url.pathname.slice(rota.prefixo.length) + url.search || "/",
      headers,
    },
    (resp) => {
      res.writeHead(resp.statusCode ?? 502, resp.headers);
      resp.pipe(res);
    },
  );
  proxy.on("error", (erro) => {
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: `serviço indisponível: ${erro.code}` }));
  });
  req.pipe(proxy);
});

servidor.listen(PORTA, "127.0.0.1", () => {
  console.log(`gateway local em http://127.0.0.1:${PORTA}`);
});
