import { parseEnv, serverEnvSchema } from "./schema";

/**
 * Validação executada na inicialização do servidor (instrumentation.ts).
 * Lança `EnvValidationError` listando as variáveis inválidas, abortando o boot.
 */
export function validarAmbienteNaInicializacao(): void {
  parseEnv(serverEnvSchema, process.env, "inicialização do servidor");
}
