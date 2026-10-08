import { clientEnvSchema, parseEnv, type ClientEnv } from "./schema";

/**
 * Variáveis públicas. Cada uma precisa ser referenciada literalmente
 * (`process.env.NEXT_PUBLIC_X`) para que o Next.js a embuta no bundle.
 */
export const clientEnv: ClientEnv = parseEnv(
  clientEnvSchema,
  {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
  "variáveis públicas",
);
