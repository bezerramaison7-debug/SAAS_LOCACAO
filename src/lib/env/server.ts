import "server-only";

import { parseEnv, serverEnvSchema, type ServerEnv } from "./schema";

/** Variáveis do servidor (inclui segredos). Nunca importar em Client Components. */
export const serverEnv: ServerEnv = parseEnv(
  serverEnvSchema,
  {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    REPORT_SIGNING_SECRET: process.env.REPORT_SIGNING_SECRET,
    SENTRY_DSN: process.env.SENTRY_DSN,
  },
  "servidor",
);
