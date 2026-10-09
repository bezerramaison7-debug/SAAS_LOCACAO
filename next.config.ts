import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

import { clientEnvSchema, parseEnv } from "./src/lib/env/schema";

/**
 * Cabeçalhos de segurança estáticos. A CSP (com nonce por requisição) é
 * definida em `src/proxy.ts`, pois precisa ser gerada a cada requisição.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), geolocation=(self), microphone=(), payment=(), usb=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

const nextConfig: NextConfig = {
  // D-24: Cache Components desligado. Toda página é renderizada por requisição,
  // no contexto do usuário autenticado; nenhum dado de empresa é cacheado no servidor.
  poweredByHeader: false,
  reactStrictMode: true,
  typedRoutes: true,
  experimental: {
    serverActions: {
      // Uploads não passam por Server Actions (usam /api/files com limite próprio).
      bodySizeLimit: "1mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default function config(fase: string): NextConfig {
  // Variáveis NEXT_PUBLIC_* são embutidas no bundle durante o build: falhar aqui
  // evita publicar um bundle com valores ausentes. Segredos são validados na
  // inicialização do servidor (src/instrumentation.ts).
  if (fase === PHASE_PRODUCTION_BUILD) parseEnv(clientEnvSchema, process.env, "build");
  return nextConfig;
}
