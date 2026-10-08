#!/usr/bin/env node
/**
 * Gera as chaves anon/service_role (JWT HS256) a partir do segredo de
 * DEMONSTRAÇÃO público do Supabase local. Uso exclusivo da stack local (D-36);
 * nunca usar estes valores em homologação/produção.
 *
 *   node scripts/stack/chaves.mjs          → imprime variáveis de ambiente
 */
import { createHmac } from "node:crypto";

export const SEGREDO_DEMO = "super-secret-jwt-token-with-at-least-32-characters-long";

const b64url = (dados) => Buffer.from(dados).toString("base64url");

export function assinar(payload, segredo = SEGREDO_DEMO) {
  const cabecalho = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const corpo = b64url(JSON.stringify(payload));
  const assinatura = createHmac("sha256", segredo)
    .update(`${cabecalho}.${corpo}`)
    .digest("base64url");
  return `${cabecalho}.${corpo}.${assinatura}`;
}

export const ANON_KEY = assinar({ iss: "supabase-demo", role: "anon", exp: 1983812996 });
export const SERVICE_ROLE_KEY = assinar({
  iss: "supabase-demo",
  role: "service_role",
  exp: 1983812996,
});

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`JWT_SECRET=${SEGREDO_DEMO}`);
  console.log(`ANON_KEY=${ANON_KEY}`);
  console.log(`SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}`);
}
