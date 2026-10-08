import { z } from "zod";

const urlHttp = z
  .url({ protocol: /^https?$/, message: "deve ser uma URL http(s) válida" })
  .transform((valor) => valor.replace(/\/+$/, ""));

const textoObrigatorio = z.string().trim().min(1, "é obrigatória");

/** Variáveis expostas ao navegador (prefixo NEXT_PUBLIC_). */
export const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: urlHttp,
  NEXT_PUBLIC_SUPABASE_URL: urlHttp,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: textoObrigatorio,
});

/** Variáveis exclusivas do servidor. */
export const serverOnlyEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: textoObrigatorio,
  REPORT_SIGNING_SECRET: z.string().min(32, "deve ter pelo menos 32 caracteres"),
  SENTRY_DSN: z.preprocess(
    (valor) => (typeof valor === "string" && valor.trim() === "" ? undefined : valor),
    z.url({ message: "deve ser uma URL válida" }).optional(),
  ),
});

export const serverEnvSchema = clientEnvSchema.extend(serverOnlyEnvSchema.shape);

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export class EnvValidationError extends Error {
  readonly problemas: readonly string[];

  constructor(escopo: string, problemas: readonly string[]) {
    super(
      [
        `Configuração inválida (${escopo}). Corrija as variáveis de ambiente abaixo (veja .env.example):`,
        ...problemas.map((p) => `  - ${p}`),
      ].join("\n"),
    );
    this.name = "EnvValidationError";
    this.problemas = problemas;
  }
}

/**
 * Valida as variáveis e falha cedo com uma mensagem que lista TODAS as
 * variáveis problemáticas. Nunca inclui o valor recebido na mensagem
 * (evita vazar segredos em logs).
 */
export function parseEnv<S extends z.ZodType>(
  schema: S,
  fonte: Record<string, string | undefined>,
  escopo: string,
): z.infer<S> {
  const resultado = schema.safeParse(fonte);
  if (resultado.success) return resultado.data;

  const problemas = resultado.error.issues.map((issue) => {
    const nome = issue.path.join(".") || "(raiz)";
    const ausente = fonte[nome] === undefined || fonte[nome] === "";
    return ausente ? `${nome}: ausente` : `${nome}: ${issue.message}`;
  });
  throw new EnvValidationError(escopo, problemas);
}
